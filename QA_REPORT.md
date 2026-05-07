# LeadGen AI - QA Audit Report
**Date:** May 7, 2026
**Auditor:** Senior QA Automation Expert

## 1. Google Maps Business Scraper
*   **Test Case:** Bulk Extraction Simulation
*   **Input:** "Plumbers in San Francisco", "Dental Clinics in London"
*   **Expected Output:** Structured lead data (Name, Phone, Address, Website).
*   **Actual Simulated Output:** **FEATURE MISSING.** Currently, leads must be added manually.
*   **Risk Level:** **HIGH** (Core value proposition missing).
*   **Fixes Needed:** Implement a background script or use an external API (e.g., Google Places API) to populate the `leads` collection.
*   **Improvement Suggestions:** Add a "Search Maps" button that triggers a simulated "scraping" animation and populates data via the Google Places API.

## 2. WhatsApp Automation
*   **Test Case:** Message Sequence Generation
*   **Input:** Scenario: "Follow Up", Platform: "WhatsApp"
*   **Expected Output:** Personalized text ready to send.
*   **Actual Simulated Output:** Works well, but relies on user manual copy/paste or manual "Send" click to record history.
*   **Risk Level:** **LOW.**
*   **Fixes Needed:** None for current "suggestion" model.
*   **Improvement Suggestions:** Integrate `wa.me/` links to open the real WhatsApp Web with the generated message pre-filled.

## 3. AI Greeting & Website Pitch
*   **Test Case:** Personalization Validation
*   **Input:** Business: "Blue Bottle Coffee", Website: "bluebottle.com"
*   **Expected Output:** Professional tone mentioning the specific business and URL.
*   **Actual Simulated Output:** Gemini handles this effectively.
*   **Risk Level:** **LOW.**
*   **Fixes Needed:** Ensure Gemini handles cases where `businessName` is generic or missing.
*   **Improvement Suggestions:** Add specialized prompts for "Low/Mid/High" ticket website offers.

## 4. Dashboard & Lead Management
*   **Test Case:** Pipeline Filtering & Sorting
*   **Input:** 20+ leads across different statuses. Filter by "Engaged". Sort by "City".
*   **Expected Output:** Instant UI update reflecting filters.
*   **Actual Simulated Output:** Functional, but status updates are one-click without confirmation.
*   **Risk Level:** **MEDIUM.**
*   **Fixes Needed:** Validation on the "Add New Lead" form (URL format, Phone Number format).
*   **Improvement Suggestions:** Add "Toast" notifications for successful saves/updates.

## 5. User Auth System
*   **Test Case:** Firebase Login & Persistence
*   **Input:** Google Sign-in. Refresh page.
*   **Expected Output:** Auth state persists across reloads.
*   **Actual Simulated Output:** Works as expected via `onAuthStateChanged`.
*   **Risk Level:** **LOW.**
*   **Fixes Needed:** None.

## 6. Payment System (Stripe)
*   **Test Case:** Subscription Flow
*   **Input:** Selection of "Growth Engine" plan.
*   **Expected Output:** Redirect to Stripe Checkout or simulated success.
*   **Actual Simulated Output:** **FEATURE MISSING.** Pricing cards have no active links.
*   **Risk Level:** **MEDIUM** (Revenue blocker).
*   **Fixes Needed:** Implement Stripe Checkout integration.

---

## Overall System Health: 60% Production Ready
The core CRM and AI generation are strong. The "Scraper" and "Payment" systems are the primary gaps to bridge before global launch.
