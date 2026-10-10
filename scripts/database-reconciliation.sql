-- Synthetic isolated databases only: scans every row and emits hashes, never row content.
SELECT format(
  'SELECT %L AS relation, count(*) AS rows, md5(coalesce(string_agg(md5(row_to_json(t)::text), '''' ORDER BY md5(row_to_json(t)::text)), '''')) AS digest FROM %I.%I t;',
  schemaname || '.' || tablename, schemaname, tablename
)
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY schemaname, tablename
\gexec
