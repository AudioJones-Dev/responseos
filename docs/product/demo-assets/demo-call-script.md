# Demo Call Script — After-Hours Accessibility Request

> **Mock data only.** Fictional caller and business; demo-safe placeholders. Not production data.

**Business:** DemoLift Accessibility Services (ramp, lift & accessibility equipment contractor)
**Channel:** Inbound voice, after-hours (AI receptionist)
**Caller:** Maria Santos · region: Pembroke Pines, FL
**Situation:** Urgent wheelchair-ramp access problem for her father after hospital discharge
**Estimated opportunity:** $1,500–$4,500 · **Timeline:** within 48 hours

> Provider note (internal only — not spoken): carrier = Telnyx (Twilio failover), orchestration = Vapi.
> These never surface in the caller-facing script.

---

**AI (greeting):**
"Thank you for calling DemoLift Accessibility Services — this is the after-hours line. I can help you
get an urgent accessibility issue handled. May I ask what's going on?"

**Caller (Maria):**
"Hi, yes — my father just came home from the hospital today and he's in a wheelchair now. The ramp at
his front door isn't safe, it's too steep and one side is loose. We can't get him in and out. I don't
know what to do."

**AI (acknowledge + reassure):**
"I'm sorry to hear that, and I understand how urgent this is — getting him in and out safely is the
priority. I can get this in front of our team right away and arrange an assessment. Let me grab a few
quick details so the right person can call you back tonight or first thing in the morning."

**AI (qualification — name):**
"Can I start with your name?"

**Caller:** "Maria Santos. It's for my father's home."

**AI (callback number):**
"Thank you, Maria. What's the best callback number to reach you?"

**Caller:** "It's [demo-safe placeholder — caller's mobile]."

**AI (location / service region):**
"Got it. And what area is the home in, so I can route this to the closest crew?"

**Caller:** "Pembroke Pines."

**AI (service type / problem detail):**
"Perfect, we cover Pembroke Pines. So this is an existing wheelchair ramp that's too steep and has a
loose side — is that right? Are we likely looking at a repair, or a replacement / new ramp?"

**Caller:** "I think it might need to be replaced. It's old. But honestly I just need someone to look
at it fast and make it safe."

**AI (urgency + timeline):**
"Understood — safety first. Do you need someone out within 24 hours, or is sometime in the next two
days workable?"

**Caller:** "As soon as possible. Definitely within the next day or two."

**AI (decision-maker):**
"And are you the right person to make the decision and approve the work, or is there someone else we
should include?"

**Caller:** "Yes, it's me. I'm handling everything for my dad."

**AI (appointment intent):**
"Great. I'll set this up as an urgent on-site assessment. Our specialist can confirm a same-day or
next-morning window when they call you back. Does that work?"

**Caller:** "Yes, please."

**AI (consent for SMS/callback):**
"One last thing — is it okay if we call and text you at this number with the appointment confirmation
and any updates?"

**Caller:** "Yes, that's fine."

**AI (close):**
"Thank you, Maria. To confirm: an urgent wheelchair-ramp assessment at a home in Pembroke Pines,
within 48 hours, and you're approved to call and text for confirmation. I've logged everything and
flagged it as urgent — our accessibility specialist will reach out shortly to lock in the time. We'll
take good care of your dad's access. Take care."

---

### Capture summary (system, not spoken)

- **Name:** Maria Santos
- **Callback consent:** granted (call + SMS)
- **Service need:** wheelchair ramp — likely repair/replacement (safety)
- **Urgency:** high (within 24–48h)
- **Location region:** Pembroke Pines, FL
- **Timeline:** within 48 hours
- **Decision-maker:** yes (caller)
- **Appointment/follow-up intent:** urgent on-site assessment, callback to confirm window
- **Summary confirmed with caller:** yes
