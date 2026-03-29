-- E2E base seed: one resource per plugin type
-- Run against the e2e_test database after backend boots (tables already exist)
INSERT INTO resources (name, type, plugin, locations, tags, active)
VALUES
  ('test-ebook.epub',    'ebook',         'ebook',         '["file:///books/test.epub"]',    '["fiction","test"]', 1),
  ('test-track.mp3',     'audio',         'music',         '["file:///music/test.mp3"]',     '["electronic"]',    1),
  ('test-video.mp4',     'video',         'video',         '["file:///video/test.mp4"]',     '["tutorial"]',      1),
  ('test-game',          'game',          'game',          '["C:\\Games\\test"]',             '["rpg"]',           1),
  ('test-gallery.zip',   'image_archive', 'pic',           '["file:///pics/gallery.zip"]',   '[]',                1),
  ('test-manga',         'online_manga',  'online_viewer', '["https://example.com/manga"]',  '[]',                1);
