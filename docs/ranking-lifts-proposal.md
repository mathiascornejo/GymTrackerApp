# Ranking lifts: proposal for approval

Every id below exists in the pinned dataset (`f00c92c`) with the primary muscle shown, checked by script. A muscle's rank is the best score among the lifts listed for it. Other exercises are still logged but do not rank.

Load model: **ext** = external load as logged, **bw+** = bodyweight plus added weight, dumbbell lifts are logged per hand.

| Muscle (dataset) | Ranking lifts | Load | Notes |
|---|---|---|---|
| chest | Barbell Bench Press - Medium Grip, Dumbbell Bench Press | ext, ext per hand | |
| shoulders | Standing Military Press, Seated Dumbbell Press | ext, ext per hand | One region: the dataset has no front/side/rear split |
| triceps | Close-Grip Barbell Bench Press, Dips - Triceps Version | ext, bw+ | |
| biceps | Barbell Curl, Dumbbell Bicep Curl | ext, ext per hand | |
| lats | Pullups, Chin-Up, Wide-Grip Lat Pulldown | bw+, bw+, ext | Pull-ups and chin-ups need a bodyweight entry |
| middle back | Bent Over Barbell Row, One-Arm Dumbbell Row | ext, ext per hand | |
| lower back | Barbell Deadlift, Hyperextensions (Back Extensions) | ext, bw+ | The dataset lists deadlift's primary muscle as lower back, not hamstrings or glutes |
| traps | Barbell Shrug | ext | |
| quadriceps | Barbell Squat, Leg Press | ext, ext (machine) | Machine loads vary between gyms |
| hamstrings | Romanian Deadlift, Stiff-Legged Barbell Deadlift | ext | |
| glutes | Barbell Hip Thrust | ext | |
| calves | Standing Calf Raises, Seated Calf Raise | ext (machine) | Machine loads vary between gyms |
| abdominals | Cable Crunch | ext (cable) | Cable stack numbers vary between gyms |
| forearms | Seated Palms-Down Barbell Wrist Curl, Seated Palm-Up Barbell Wrist Curl | ext | |
| neck | Lying Face Down Plate Neck Resistance, Lying Face Up Plate Neck Resistance | ext | Plate on head; very small loads |
| abductors | Thigh Abductor | ext (machine) | Machine only |
| adductors | Thigh Adductor | ext (machine) | Machine only |

## Known weak spots
- Machine and cable lifts (quadriceps via leg press, calves, abdominals, abductors, adductors) are not comparable between gyms. The standards for those muscles will be the least trustworthy.
- Dumbbell lifts rank per hand, so a 40 kg dumbbell press is judged against per-hand standards, not total weight.
- Standards numbers for every lift are still `// UNVERIFIED` placeholders until you give me a source.

## Decisions for you
1. Approve, or edit, the list above.
2. Any lifts you actually perform that should replace a proposed one (for example, a different calf or neck movement)?
