# Spoken pilot disabled release — November 7, 2026

EXPERIMENTAL. Runtime `f86ab4d4bdbcc86a4af74d431e0e7020feb1f98f` deployed with calls disabled. PR #246 validate and PostgreSQL 16/17/18 CI passed. No live spoken or retention qualification is claimed.

| Component | Verified release |
| --- | --- |
| Vercel | `dpl_72m7pv7zhiKnfhoorrK46i2dcpmC`, READY; canonical pilot alias health returns exact SHA, preview environment |
| Render primary | `dep-dbnjknc9v7es73cv7vkg`, LIVE 14:50:02 UTC; instance `s9djl` |
| Render watchdog | `dep-dbnjku3m8hqs73cdfjm0`, LIVE 14:50:28 UTC; instance `ffn8h`; disabled startup observed |
| Isolated Neon | `dark-lake-70639149` / `br-frosty-lake-aujruc02` / `frl_recorded_pilot`; migration `0017_frl_spoken_consent` applied atomically with ledger entry |

Both worker build guards pin the runtime SHA; automatic deployments remain off. Migration checksum `b13578121a553f5f1290f758677c4759da34d1439cebe19a85b5683e8363e205`; nullable recording parent and three added call-identity columns verified. No production/demo database migration.

Primary runtime: valid configuration, matching deployment/database bindings, authentication required, admission false, dispatch false, cleanup true, expired window. Existing keypad configuration remains installed and cannot invoke speech. Cleanup iteration completed on an empty queue without error; this proves execution/connectivity, not deletion. Pilot account paused, nine historical runs all closed, zero local artifacts/deletion tasks.

Public checks: health 200; anonymous admin API 404; missing and malformed webhook signatures 401. Alternate browser reached operator sign-in; authenticated console revalidation remains pending in the owner's signed-in browser. No auth bypass. No new call window, calls or provider mutations.

## Provider and retention evidence

Authenticated Telnyx checks returned 200: both dedicated applications inactive, first-command timeout 30 seconds; receiving outbound profile unbound. Both dedicated outbound profiles disabled, US-only, one channel, $2/day enabled, recording type none. Both application-filtered recording lists returned zero. No media downloaded.

[Telnyx recording documentation](https://support.telnyx.com/en/articles/5377454-call-recording) states recordings remain for one year unless deleted. The pilot's 24-hour policy relies on cleanup, not verified provider automatic expiry. Separate deletion endpoints cover [recordings](https://developers.telnyx.com/api-reference/call-recordings/delete-a-call-recording), [transcripts](https://developers.telnyx.com/api-reference/call-recordings/delete-a-recording-transcription) and [AI conversations](https://developers.telnyx.com/api-reference/conversations/delete-a-conversation).

The [Assistant retention toggle](https://telnyx.com/release-notes/data-retention-toggle-conversation-history-ai-insights) covers assistant-level history/insights and excludes other recording/storage settings. Applicability to our [gather_using_ai](https://developers.telnyx.com/api-reference/call-commands/gather-using-ai) request and live `transcription_start` engine B is unverified. Disabling history-update webhooks is not evidence of no provider storage.

Neon reports six hours of restore history; this is not proof of immediate physical backup erasure. Provider backup timing, recognition input/output retention and late transcription recreation remain unverified. No `providerRetentionVerified`, speech `retentionVerified` or `withdrawalVerified` assertion was installed.

## Approval and remaining qualification

Owner stated “Legal is approved” after approving spoken-v2 wording/transient controls. Reference `owner-attested-legal-20261107-chat-01a1b18a`, chat `01a1b18a-d1a7-7570-84a9-ed27ec286624`. This is owner-attested legal approval, not independent legal review; no call window follows from it.

Subsequent owner approval accepted the bounded one-call qualification in FRL-PILOT-010, described in [commissioning preparation](FRL_RECORDED_COMMISSIONING_PREP.md). Provider retention and backup erasure remain unverified; the exception permits observable testing without inventing evidence. Before that recorded call, qualify manual stop and watchdog failure in capture-off operation, verify the receiving endpoint and agree a fresh supervised window. Spoken withdrawal is an outcome to establish during qualification. Ordinary silence can trigger the experimental 15-second monitor cutoff.

## Engineering inquiry — sent with owner authorization

Sent November 7 to Telnyx support; Gmail message/thread reference `1a1b680afc0b72b9`. No engineering guarantee or ticket confirmation is claimed. The following preserves the inquiry wording.

We use Call Control `gather_using_ai` for yes/no consent and `transcription_start` engine B for transient stop-recording controls, including after refusal. No control text is persisted locally. Please confirm:

1. What audio, text, conversation history, insights and diagnostic content do these APIs retain, for how long, and under which exact settings? Does Assistant Builder “Do not retain” apply, and how is it selected and verified for these requests?
2. What does DELETE `/v2/ai/conversations/{id}` remove, and what survives in recognition logs, recordings or backups? Can deletion during/after gather affect final callbacks or recreate content later?
3. After DELETE `/v2/recordings/{id}` and `/v2/recording_transcriptions/{id}`, when is content inaccessible and permanently removed, including backups? Can pending transcription recreate it, and what reconciliation sequence is supported?
4. Which authenticated metadata checks prove absence without downloading content, with what consistency delays? Can all retained test content be bounded to 24 hours, with earlier deletion after withdrawal?

Please provide documented settings and guarantees. Information only, no account changes or credentials. The owner separately authorized sending this inquiry.
