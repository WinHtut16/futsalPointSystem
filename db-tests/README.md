# Database tests

A throwaway Postgres, every migration loaded into it from scratch, and
assertions about what the triggers and policies actually do.

## Why this exists

The audit log is about 600 lines of triggers, and `public.audit()` deliberately
has **no exception handler** — if a trigger raises, the operation it was
watching fails. That is the right trade (no correction to a session's takings
without a record of it), but it means an untested trigger does not fail quietly
by missing a log row. It fails loudly, by blocking a price change or a session
correction on a live system.

None of that SQL had ever executed when it was written. This is how it got run
before the client saw it.

It also proves something nobody had checked: that the whole migration chain
applies cleanly to an empty database, in order.

## What it does NOT do

It does not test the apps. No browser, no Next.js, no clicking. Anything that
depends on the UI — that the Save button is wired up, that the report page adds
the right column — still needs a person. This tests the layer underneath, which
is the layer that cannot be checked by looking at a screen.

## Running it

Needs PostgreSQL 16 locally (`psql`, `initdb`, `pg_ctl`) and the sibling repos
checked out beside this one:

    D:\Myathida\PointSystem_AkoATP     <- you are here
    D:\Myathida\Billiards_MyaThida
    D:\Myathida\MyaThida_Game

Then:

    cd db-tests
    ./run.sh

It prints one line per assertion and a count at the end. Any FAIL is a real
finding: these all passed when they were written.

## The scaffold is not a Supabase simulator

`00-scaffold.sql` creates only what the migrations actually touch: the
`auth` schema, `auth.uid()` reading a session setting, the three PostgREST
roles, and the `supabase_realtime` publication.

One line in it is load-bearing rather than decorative:

    alter default privileges in schema public
      grant all on functions to postgres, anon, authenticated, service_role;

That is Supabase's own bootstrap, and reproducing it is what makes
"`audit()` must not be callable by a signed-in session" a real test. Without
it the assertion would pass on a database that was never permissive in the
first place — and would have passed just as happily against the version of
this code that *was* vulnerable.

For the same reason there are control assertions ("grant_app_access IS
executable by authenticated", "the global superadmin sees every business").
A test that everything is forbidden passes beautifully on a broken database.

## Confirmed to bite

A suite that would be green anyway is worse than none, so three mutations were
run against a passing database:

| mutation | result |
|---|---|
| re-grant `audit()` to `authenticated` (undo the phase 2 fix) | FAIL, as it should |
| add `stock` to the game product watch list | FAIL — the noise filter is real |
| add an INSERT policy to `audit_log` | FAIL — append-only is real |
