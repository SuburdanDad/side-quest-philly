-- Same as Supabase self-hosting: service roles share the local DB password.
\set pgpass `echo "$POSTGRES_PASSWORD"`
ALTER USER authenticator WITH PASSWORD :'pgpass';
ALTER USER supabase_auth_admin WITH PASSWORD :'pgpass';
ALTER USER supabase_admin WITH PASSWORD :'pgpass';
ALTER USER postgres WITH PASSWORD :'pgpass';
