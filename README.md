# framer-hook
A module for Framer that lets you easily hook a layer's property onto another object via spring or gravity.

The original use case was to layer a spring animation on top of an eased animation, to give more control over the timing and feel of a transition. Please see the spring example (hook-example-spring.framer) to get a better idea how the level of control it gives you.

I'm not a developer nor a mathematician, so much of this is improvised, particularly the physics. Please do let me know, or create a pull request, if you have any suggestions for improvements.

A more thorough documentation is included in the comments at the top of Hook.coffee.


### Example: Layered animation (eased + spring)

`
myLayer = new Layer

\# Make our own custom property for the x property to follow
myLayer.easedX = 0

\# Hook x to easedX via a spring
myLayer.hook
	property: "x"
	targetProperty: "easedX"
	type: "spring(150, 15)"

\# Animate easedX
myLayer.animate
	properties:
		easedX: 200
	time: 0.15
	curve: "cubic-bezier(0.2, 0, 0.4, 1)"
`

NOTE: 
To attach both the x and y position, use "pos", "midPos" or "maxPos" as the
property/targetProperty.


## Example: Hooking property to another layer

`
target = new Layer
hooked = new Layer

hooked.hook
	property: "scale"
	to: target
	type: "spring(150, 15)"
`

The "hooked" layer's scale will now continuously follow the target layer's scale
with a spring animation.