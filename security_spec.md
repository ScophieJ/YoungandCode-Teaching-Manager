# YoungAndCode Teaching Manager — Security Specification

## 1. Data Invariants
1. **Strict Workspace Ownership**: Every document in `teachers`, `students`, `lessonPlans`, `classReports`, `aiReports`, `homework`, `resources`, `monthlyReports`, and `integrations` belongs exclusively to the authenticated, email-verified teacher whose UID matches `teacherId` (or `uid` on `teachers/{teacherId}`).
2. **No Blanket List Queries**: Every `allow list` rule enforces `resource.data.teacherId == request.auth.uid` so cross-user scraping is impossible even if the client is bypassed.
3. **Referential Integrity**: Every `lessonPlans`, `classReports`, `aiReports`, `homework`, `resources`, and `monthlyReports` document created must reference an existing `students/{studentId}` document owned by the same `request.auth.uid`.
4. **Immutable Ownership & Creation Timestamps**: `teacherId`, `studentId` (on child records), `catalogId`/`isCustom` (on integrations), and `createdAt` cannot be modified after creation. `createdAt` and `updatedAt` are validated against `request.time`.
5. **Terminal State Protection**: Completed `classReports` (`status == 'completed'`) cannot revert back to `'in_progress'`, and approved `monthlyReports` (`status == 'approved'`) cannot revert back to `'draft'` or alter `approvedAt`.
6. **Strict Schema & Volumetric Bounds**: All fields are allowlisted via `hasAll`/`hasOnly` on create and `affectedKeys().hasOnly(...)` on update, with explicit type, regex, enum, URL scheme (`https?://`), list-size (max 10 homework links, max 2 subject assessments, max 5 integration methods), and `.size()` checks on every string and array. Credentials/tokens/secrets are strictly prohibited in Firestore documents.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Unauthenticated Read/Write**: Read `/students` or write `/students/s1` without `request.auth`. -> `PERMISSION_DENIED`.
2. **Unverified Email Write**: Write `/students/s1` with `email_verified: false`. -> `PERMISSION_DENIED`.
3. **Identity Spoofing on Create**: Create `/students/s2` with `teacherId: "other-teacher-uid"`. -> `PERMISSION_DENIED`.
4. **Cross-Tenant List Query**: Query `/students` without `.where('teacherId', '==', uid)`. -> `PERMISSION_DENIED`.
5. **Shadow / Ghost Field Injection**: Create `/students/s3` with valid fields plus `isAdmin: true` or `shadowField: "x"`. -> `PERMISSION_DENIED`.
6. **Orphaned Child Record**: Create `/lessonPlans/lp1` referencing a non-existent `studentId` or another teacher's `studentId`. -> `PERMISSION_DENIED`.
7. **ID Poisoning**: Create `/students/` with ID containing invalid characters (`../bad` or >128 chars). -> `PERMISSION_DENIED`.
8. **Timestamp Forgery**: Create `/homework/hw1` with client-supplied past `createdAt` instead of `request.serverTimestamp()` (`request.time`). -> `PERMISSION_DENIED`.
9. **Immutable Ownership Tampering**: Update `/students/s1` changing `teacherId` or `createdAt`. -> `PERMISSION_DENIED`.
10. **Array Element / Size Poisoning**: Create `/students/s4` with `subjects: ["Hacking"]` or `subjects: []` or 5 elements. -> `PERMISSION_DENIED`.
11. **Value Poisoning on Update**: Update `/homework/hw1` setting `status: "invalid_status"` or a 5,000-char `title`. -> `PERMISSION_DENIED`.
12. **Terminal State Regression**: Update a `classReports` doc from `status: "completed"` back to `status: "in_progress"`. -> `PERMISSION_DENIED`.
13. **Oversized Homework Links**: Create `/homework/hw_overflow` with >10 `supportingLinks`. -> `PERMISSION_DENIED`.
14. **Malformed Homework Date**: Update `/homework/hw_1` with `submittedDate: "not-a-date"`. -> `PERMISSION_DENIED`.
15. **Approved Monthly Report Regression**: Update `/monthlyReports/mr_approved` from `status: "approved"` back to `status: "draft"`. -> `PERMISSION_DENIED`.
16. **Monthly Report Subject Assessment Overflow**: Create `/monthlyReports/mr_bad` with 3 items in `subjectAssessments` or invalid `monthKey`. -> `PERMISSION_DENIED`.
17. **Unsafe JavaScript URL in Integration**: Create `/integrations/int_xss` with `websiteUrl: "javascript:alert(1)"`. -> `PERMISSION_DENIED`.
18. **Credential / Secret Field Injection on Integration**: Create `/integrations/int_secret` containing `apiKey: "sk-secret"` or `accessToken: "tok"`. -> `PERMISSION_DENIED`.
