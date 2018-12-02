Ludum Dare 43 - TBD
============================

LD43 Entry by Jimbly

* Using [Javascript libGlov/GLOV.js framework](https://github.com/Jimbly/turbulenz-playground)

Start with: `npm start` (after running `npm i` once)

Notes:
* Didn't realize could drag from beakers to pets, pets to orders, pets to spikes

TODO:
* Potion order requirements are a bit high too quickly? Especially Pure of 16!
  * 10 of each (5 turns minimum) is probably a more reasonable max
* High scores
* Daily summary if things go wrong - especially if pets are starving - Modal confirm first
* Show picked up potion and/or pet under mouse
  * Highlight all possible places it could go
* Would be useful to see current stats of all potions (and pets) - roll over something and they all show up? Always there? Hold shift?
* Really need to show (floaters?) what happens when brewing
* New button and panel graphics
* Allow selecting pet first, then food, show same tooltip

Polish
* Animate pipes rotating
* Tutorial or more instruction - Help button with flow-chart?
* Sounds / Music
  * Sacrifice squish
  * Brew burble
* Pets wander when mouse not near them
* Pets smoothly move from position to position, including from store purchase window
* Quick animation up clicking Brew

Graphics
* Shadows under pets
* Animate pets
* More pet variety and size variety - why?  Just make slimes better? and we're a Slime Slaughterer?
* Gears or pattern in background of pipes board

Stretch
* Pets grow in size after being fed?  Or their size is fixed?


Original notes:
Alchemical Menagerie
* Art
** Bottles
** Pipes
** Critters
** 3 attribute icons
** 2 tapability icons?
* Mechanics
** Pipe Dreams
*** Generate board that's guaranteed to make a few paths (generate 3 paths, then rotate, than fill in random? just do random and see how it goes?)
*** Allow dragging of creatures to taps
*** Button to clear individual taps - no, just overwrite
*** Show how much is left in each tap
*** Show current results
*** Drag potions to creatures, trash, or Current Goal
** Creatures
*** Drink potions, stats change
** Current Goals

Critters
* Slug ("Doom Slug"?)
* Beholder
* Dragon
* Gryphon
* Panda
* Krell (shrimp or froglike)
