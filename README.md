# Hook module for Framer
![Spring example](http://www.sigurd.io/framer-hook/hook-example-spring.framer/spring-example-720.gif)

The Hook module expands Framer's Layer prototype, and lets you make any numeric Layer property follow another property - either its own or another object's - via a spring or gravity attraction.

Enough chat. Examples:

[Example 1: Easing + spring](http://www.sigurd.io/framer-hook/hook-example-spring.framer/)

[Example 2: Modulation from one property type to another](http://www.sigurd.io/framer-hook/hook-example-modulator.framer/)

[Example 3: Gravity, too](http://www.sigurd.io/framer-hook/hook-example-gravity.framer/)

The original use case was to layer a spring animation on top of an eased animation to give more control over the timing and feel of a transition, as seen in Example 1. You do not need two layers to achieve this though, as shown in the first code snippet below.

I'm not a developer nor a mathematician, so much of this is improvised, particularly the physics. Please do let me know, or create a pull request, if you have any suggestions for improvements.

For a more detailed documentation, check the comments at the top of Hook.coffee.


### Example: Layered animation (eased + spring)

```
myLayer = new Layer

# Make our own custom property for the x property to follow
myLayer.easedX = 0

# Hook x to easedX via a spring
myLayer.hook
	property: "x"
	targetProperty: "easedX"
	type: "spring(150, 15)"

# Animate easedX
myLayer.animate
	properties:
		easedX: 200
	time: 0.15
	curve: "cubic-bezier(0.2, 0, 0.4, 1)"
```

NOTE: 
To attach both the x and y position, use "pos", "midPos" or "maxPos" as the
property/targetProperty.


### Example: Hooking property to another layer

```
target = new Layer
hooked = new Layer

hooked.hook
	property: "scale"
	to: target
	type: "spring(150, 15)"
```

The "hooked" layer's scale will now continuously follow the target layer's scale
with a spring animation.


### Example: Adding a modulator function

The modulator function allows you to do anything you want with the target property's value before it is applied. As a very basic example, let's say you want to convert one layer's y position into a corresponding scale value for another layer:

```
target = new Layer
hooked = new Layer

hooked.hook
	property: "scale"
	to: target
	targetProperty: "y"
	type: "spring(200,20)"
	modulator: (input) -> Utils.modulate(input, [0, 400], [0.5, 1])
```

### Documentation

A more thorough documentation is included in the comments at the top of Hook.coffee.