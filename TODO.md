# Stuff to do

- [x] can we render the game in such a way that it works nicely in portrait mode on mobile devices?
- [x] I dont like having paragon skills that just grant an ability that is shared with cards. (twin cannons, nova core)
- [x] i dont see a visual for thermal lance
- [x] dont use the word "seed" so much. it works for clouds
- [x] the mines can probably be launched by the guns in a parabolic way. it might be cute if they are held up by balloons
- [x] salvo is too good.
- [x] i still dont see the movement button in the test page
- [x] test page needs to be organized better. i dont like all the scrolling i need to do
- [x] when we dont have more cards to show the player, we should have some generic cards like + stardust or something
- [x] we need sounds
- [x] store progress local storage, allow resetting
- [x] lets make the ballons slowly rise and hold at the top of the screen

## Gameplay & content

- [x] more enemy variety: a shielded invader (first hit breaks the shield), a zigzag dodger that's hard to intercept, a healer that mends nearby invaders
- [ ] more boss variety — every 10th wave is the same mothership right now; add a second boss type and alternate, or give later motherships new tricks (shields, beam attacks)
- [x] seems weird that the boss crashes into us. it should probably always shoot down. different bosses could have more/different weapons
- [x] elite modifiers: elites could spawn with a random affix (fast / regenerating / splitting) instead of just being big
- [x] run summary screen: show per-weapon damage breakdown at the end of a run (the sandbox already tracks damageBySource — reuse it)
- [x] card reroll
- [x] flame thrower weapon
- [x] in the paragon tree make even more nodes by making the steps more incremental.

## Balance

- [x] run the lab benchmark across all weapons and level the outliers (epics should beat rares per pick)
- [ ] check the difficulty curve past wave 20 — hp growth 1.16^wave probably outruns card scaling at some point
- [ ] cloud cover / lockdown / nanite have no benchmark numbers — figure out how to value utility cards in the lab (time-to-leak? damage prevented?)

## Mobile & UX

- [ ] handle device rotation mid-run (arena shape is currently locked at run start)
- [ ] PWA manifest + service worker so it installs to the home screen and works offline
- [x] settings panel: volume slider (not just mute), screen-shake toggle, damage numbers toggle
- [x] export / import save as a code string so progress can move between devices
- [ ] bigger touch targets on the level-up cards in portrait

## Audio

- [x] pitch/volume variation per sound so repeated effects don't sound machine-gun identical
- [x] give me a prompt to generate music with a music LLM (see MUSIC_PROMPT.md — synthesized ambient loop also added in the meantime, toggleable in settings)

## Tech

- [x] code-split the Phaser chunk (build warns at 1.4 MB) — dynamic-import the game only on /game and /lab
- [x] cap delta in the update loop so a backgrounded tab doesn't fast-forward a giant frame on return

- [x] paragon board is not zoomable on mobile
- [x] thermal lance is too good. can it not pierce?
- [x] on mobile there are some tiny overlap issues (basically the timer appears under all the butotns. not a huge deal because the timer isnt that important)
- [x] speed controls on the lab
- [x] on mobile the boss is too high and unreachable. make it so they always need to be within the guns range
