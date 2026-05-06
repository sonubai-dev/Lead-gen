# Security Specification - LeadGen-AI

## Data Invariants
- Leads can only be created by authenticated users.
- Leads must have a valid business name and phone number.
- Status and conversation history are managed by the agent, not the business being contacted.

## "Dirty Dozen" Payloads
1. Create lead with missing phoneNumber.
2. Create lead with businessName > 128 characters.
3. Update status of lead to "closed" without conversation history (should be blocked if logic dictates).
4. Update conversationHistory with unauthorized field.
5. List leads as unauthenticated user.
6. Get lead details as authenticated user not authorized to view this lead.
7. ... (other payloads)

## Test Runner (firestore.rules.test.ts)
(To be implemented)
