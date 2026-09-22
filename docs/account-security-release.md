# Account security foundation

The authenticated `/settings/security` page shows provider-verified identity and verified JWT assurance, plus the number of verified factors returned by Auth. It does not expose secrets or list other users. Settings links to it. Accounts without company membership can still manage their own sessions.

Global sign-out requires an explicit checkbox, revalidates the user server-side, and accepts no user selector or scope from the browser. Provider errors return generic feedback; the success redirect is outside the catch. Only a user deliberately submitting this form terminates sessions; deployment and automated validation do not terminate real users' sessions.

Global sign-out revokes refresh sessions. Already-issued access tokens can remain valid until expiry. The form and return notice disclose this limit. It is not an instant remote device kill switch or deletion of downloaded files. See [Supabase sign-out behavior](https://supabase.com/docs/guides/auth/signout).

## Mandatory MFA remains incomplete

No authenticator enrollment, factor deletion or organization-wide enforcement is enabled by this increment. Do not advertise MFA as enforced. The next release must address:

1. TOTP enrollment, initial verification and subsequent challenge using user-session clients; secret material only in the enrollment response, never logs or persistent browser storage.
2. AAL2 checks in database policies and privileged RPCs as well as actions/API routes. Inventory all privileged paths, including direct PostgREST requests and storage, before modifying a shared authorization helper.
3. Staged enrollment of existing privileged users, with identity-verified operator recovery and lockout rehearsal. Email sign-in alone must not silently bypass an enrolled second factor.
4. Hosted staging tests for two-factor success, replay/expired codes, AAL1 denial, token refresh, suspended membership and cross-tenant access. Mocked provider tests are insufficient to activate mandatory enforcement.
5. Explicit release status and rollback procedures that preserve access controls and do not indiscriminately delete authenticators.

Reference: [Supabase MFA](https://supabase.com/docs/guides/auth/auth-mfa/totp). This page is a foundation, not completion of the launch security checklist.
