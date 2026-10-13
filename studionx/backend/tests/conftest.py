"""테스트 공통 설정.

테스트 중에는 Sentry 를 끔 — .env 에 SENTRY_DSN 이 있어도 테스트가 일부러 낸 오류·요청이
실제 Sentry 프로젝트로 가지 않게 한다. (환경 변수가 .env 보다 우선, app 을 불러오기 전에 설정)
"""

import os

import pytest
from sqlalchemy import inspect
from sqlalchemy.exc import OperationalError

os.environ["SENTRY_DSN"] = ""  # app 은 아래 fixture 안에서 불러온다 (이 설정 뒤)


@pytest.fixture
def db():
    """실제 MySQL 세션. 연결할 수 없으면 시험을 건너뛰고, 넣은 행은 끝나면 모두 되돌린다.

    바깥 트랜잭션 안에서 세션을 열고(join_transaction_mode="create_savepoint"),
    코드 안의 db.commit() 은 저장점(SAVEPOINT)만 확정한다 → 시험이 끝나면 바깥을 rollback.
    그래서 commit 을 하는 signup() 같은 함수도 실제 DB 에 행을 남기지 않는다.
    """
    from sqlalchemy.orm import Session

    from app.db.session import engine

    try:
        connection = engine.connect()
    except OperationalError:
        pytest.skip("DB 에 연결할 수 없음")
    outer = connection.begin()
    session = Session(
        bind=connection,
        join_transaction_mode="create_savepoint",
        autoflush=False,
        expire_on_commit=False,
    )
    yield session
    session.close()
    outer.rollback()
    connection.close()


@pytest.fixture
def assert_matches_db(db):
    """ORM 모델의 칸 이름 · 순서 · NULL 허용 · FK(ON DELETE 포함)가 실제 테이블과 같은지 확인.

    partial=True: 모델이 칸의 일부만 가진 경우 (예: tracks — Phase 1 칸만). 그 칸들만 비교한다.
    """

    def check(model, partial=False):
        table = model.__tablename__
        inspector = inspect(db.connection())
        actual = {c["name"]: c for c in inspector.get_columns(table)}
        mine = {c.name: c for c in model.__table__.columns}
        if partial:
            actual = {name: c for name, c in actual.items() if name in mine}
        assert list(mine) == list(actual), table
        for name, col in mine.items():
            assert col.nullable == actual[name]["nullable"], f"{table}.{name}"
        # FK: 이름 · 가리키는 칸 · ON DELETE. 아직 모델이 없는 테이블을 가리키는 FK 는 뺀다
        modeled = model.metadata.tables
        actual_fks = {
            (
                tuple(fk["constrained_columns"]),
                fk["referred_table"],
                tuple(fk["referred_columns"]),
                fk["options"].get("ondelete"),
            )
            for fk in inspector.get_foreign_keys(table)
            if fk["referred_table"] in modeled and fk["constrained_columns"][0] in mine
        }
        mine_fks = {
            ((fk.parent.name,), fk.column.table.name, (fk.column.name,), fk.ondelete)
            for fk in model.__table__.foreign_keys
        }
        assert mine_fks == actual_fks, table

    return check
