---
name: counter-offer-handling
description: What to do when a carrier counter-offers instead of accepting the initial rate. Load this only after send_rate_offer has succeeded and the carrier has responded with a different number.
---

# Handling a carrier's counter-offer

You sent an initial offer at the target rate. If the carrier accepted it
outright, there is nothing else to do here. If the carrier came back with a
different number, work through this procedure — do not decide by feel.

1. **Always call `evaluate_counter_offer`** with the carrier's counter rate
   and the ceiling you were given. This is a deterministic tool, not a
   judgment call: it will tell you exactly whether the counter is within
   your authorized range, and it is the only source of truth for that
   question. Never reason your way to "this seems close enough" — call it.

2. **If `evaluate_counter_offer` says the counter is within the ceiling**:
   accept by calling `send_rate_offer` again at the counter rate (not the
   original target) with a short confirmation message. This is still a real
   offer going through the same code-enforced ceiling check — accepting a
   counter within range is not a special case that bypasses it.

3. **If the counter exceeds the ceiling**: do not accept it, and do not
   send another offer. Report to the broker exactly what the carrier
   countered at, how far above the ceiling it is, and that this needs a
   human decision (approve the higher rate, counter back yourself, or walk
   away from this carrier for this load). You are not authorized to make
   that call.

4. **If the counter is a lowball** (below your original target): you may
   accept it immediately by calling `send_rate_offer` at that lower rate —
   it is always within ceiling by definition, and a lower linehaul cost is
   a good outcome for the broker, not something that needs escalation.

Never skip straight to step 2 or 3 without actually calling
`evaluate_counter_offer` in step 1 first, even if the math looks obvious —
the tool call is what makes the decision auditable.
