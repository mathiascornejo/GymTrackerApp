# Measuring the background rest alarm

The brief asks for measured delays, not claimed precision. Do this on your own phone once the hosted project and function are set up (steps 10 to 16 in `setup-supabase.md`).

## What is measured
A rest timer has a `fire_at`. The alarm path is: pg_cron (every 5 s) wakes the function, which waits until `fire_at` and sends the push; the push service delivers it; your phone shows it. The service worker records when the notification arrived, and Settings shows "The last background alarm arrived N s after its timer ended".

## Procedure (repeat on each phone you care about)
1. Install the app (iPhone: from the Home Screen), sign in, and turn on notifications in Settings.
2. Start a session, tap the Rest button, then lock the phone or switch to another app. Use a short rest (15 s) for speed.
3. When the notification arrives, open Tempered and read the delay in Settings. Write it down.
4. Do 10 runs, spread over a few hours. Also try: Low Power Mode on, Focus mode on, phone idle for 30 minutes before the timer, and the app force-quit.

## Record
| Run | Phone and OS | Condition | Delay (s) |
|---|---|---|---|
| 1 | | | |

## What to report
Median, 90th percentile and worst delay per phone, plus any run where nothing arrived. The server side measured 0.007 s on the local stack; everything beyond that is the push service and the device, which only a phone can show.
