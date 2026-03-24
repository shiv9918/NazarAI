-- Delete all data from database (preserves schema)
-- This will clear: reports, WhatsApp sessions, and all users (citizens, departments, commissioners, admins)

-- Disable foreign key constraints temporarily
ALTER TABLE reports DISABLE TRIGGER ALL;
ALTER TABLE whatsapp_sessions DISABLE TRIGGER ALL;
ALTER TABLE users DISABLE TRIGGER ALL;

-- Delete all data
DELETE FROM reports;
DELETE FROM whatsapp_sessions;
DELETE FROM users;

-- Re-enable foreign key constraints
ALTER TABLE reports ENABLE TRIGGER ALL;
ALTER TABLE whatsapp_sessions ENABLE TRIGGER ALL;
ALTER TABLE users ENABLE TRIGGER ALL;

-- Reset sequences
ALTER SEQUENCE reports_complaint_number_seq RESTART WITH 1000;

-- Verify deletion
SELECT 'Reports' as table_name, COUNT(*) as row_count FROM reports
UNION ALL
SELECT 'Users' as table_name, COUNT(*) as row_count FROM users
UNION ALL
SELECT 'WhatsApp Sessions' as table_name, COUNT(*) as row_count FROM whatsapp_sessions;
