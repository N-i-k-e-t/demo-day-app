# QA / Live Event Test Scenarios

- Join with valid name/email.
- Startup list renders all 15 startups.
- Open Startup 3 and choose Interested.
- Confirm the response is stored.
- Return to list; Startup 3 is green.
- Re-open Startup 3; previous response cannot be changed.
- Choose Explore More for Startup 2; Startup 2 becomes yellow.
- Choose Not Interested for Startup 1; Startup 1 becomes blue.
- Refresh; all colors persist.
- Open My Responses; only this investor's responses appear.
- Switch to Admin; aggregate counts increase.
- Prepare Stage; stage shows loading/preparing, not investor details.
- Publish Stage; stage shows only published percentages.
- Verify stage never renders individual names or live response events.
- Open two tabs and confirm state is synchronized by BroadcastChannel.
- Reset demo and verify local data is cleared.
