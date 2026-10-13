-- Studio Nx: 모든 테이블 삭제 (개발용 초기화)
-- ⚠ 데이터가 전부 지워집니다. 운영 DB에서 절대 실행하지 마세요.
-- 실행 후 01~06 을 다시 실행하면 빈 스키마로 재생성됩니다.

USE studionx;

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS project_snapshots;
DROP TABLE IF EXISTS timeline_comments;
DROP TABLE IF EXISTS chat_messages;
DROP TABLE IF EXISTS project_change_logs;
DROP TABLE IF EXISTS invitations;
DROP TABLE IF EXISTS assistant_messages;
DROP TABLE IF EXISTS ai_recommendations;
DROP TABLE IF EXISTS ai_analyses;
DROP TABLE IF EXISTS reference_tags;
DROP TABLE IF EXISTS reference_tracks;
DROP TABLE IF EXISTS separation_stems;
DROP TABLE IF EXISTS separation_jobs;
DROP TABLE IF EXISTS export_jobs;
DROP TABLE IF EXISTS user_settings;
DROP TABLE IF EXISTS project_templates;
DROP TABLE IF EXISTS markers;
DROP TABLE IF EXISTS midi_cc_events;
DROP TABLE IF EXISTS track_connections;
DROP TABLE IF EXISTS track_sends;
DROP TABLE IF EXISTS track_instruments;
DROP TABLE IF EXISTS meter_changes;
DROP TABLE IF EXISTS tempo_changes;
DROP TABLE IF EXISTS automation_points;
DROP TABLE IF EXISTS automation_lanes;
DROP TABLE IF EXISTS midi_notes;
DROP TABLE IF EXISTS clips;
DROP TABLE IF EXISTS launcher_scenes;   -- 2026-10-06 삭제된 표 (예전 DB 정리용으로 남김)
DROP TABLE IF EXISTS patterns;
DROP TABLE IF EXISTS track_plugin_links;
DROP TABLE IF EXISTS track_plugins;
DROP TABLE IF EXISTS tracks;
DROP TABLE IF EXISTS plugin_presets;
DROP TABLE IF EXISTS plugins;
DROP TABLE IF EXISTS sample_tags;
DROP TABLE IF EXISTS tags;
DROP TABLE IF EXISTS samples;
DROP TABLE IF EXISTS project_sessions;
DROP TABLE IF EXISTS project_members;
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS dev_notes;
DROP TABLE IF EXISTS inquiries;
DROP TABLE IF EXISTS users;

SET FOREIGN_KEY_CHECKS = 1;
