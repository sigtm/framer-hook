###

Hook example
--------------

Note: This example uses two layers to illustrate the concept more clearly, but
the separate layer for the eased animation is unnecessary. We could just as easily
have created another property, say layer.easedX, and hooked the x property to that.
Then you'd just run layer.animate() on the easedX property like you would any
other property.

The Hook module simply expands the Layer prototype, and lets you make any
numeric Layer property follow a property on another object via a spring or a
gravity attraction. Check the comments in modules/Hook.coffee for a more thorough
documentation.

###



# Require Hook. No exports, it just adds methods to the Layer prototype
# --------------------------------------------------------------------------------

require "Hook"



# Settings
# --------------------------------------------------------------------------------

colors =
	background: "#260355"
	orange: "#f90"
	blue: "#63ffff"
	primary: "white"
	secondary: "rgba(255,255,255,0.1)"

margin = 60

easeInOut = "cubic-bezier(0.2, 0, 0.4, 1)"



# Set background and defaults
# --------------------------------------------------------------------------------

Framer.Device.viewport.backgroundColor = colors.background

Framer.Defaults.Animation =
	curve: easeInOut
	time: 0.15



# Set up example
# --------------------------------------------------------------------------------

eased = new Layer
	x: margin
	y: 300
	width: 100
	height: 100
	backgroundColor: colors.blue
	borderRadius: 12

eased.states.add
	right:
		maxX: Screen.width - margin

hooked = new Layer
	x: eased.x
	y: eased.maxY + margin
	width: 100
	height: 100
	backgroundColor: colors.orange
	borderRadius: 12


# We run hook() in the slider change callback
runAnim = () ->
	
	# Remove any existing hooks, since we want updated spring values
	hooked.unHook 'x', eased

	# Attach the x property to the eased layer with the sliders' spring values
	hooked.hook
		property: 'x'
		to: eased
		type: 'spring(' + spring.value + ', ' + friction.value + ')'
	
	# Animate the eased layer
	eased.states.animationOptions =
		curve: easeInOut
		time: speed.value / 1000
	
	eased.states.next()



# Styled slider class
# --------------------------------------------------------------------------------

class Slider extends SliderComponent

	constructor: (config) ->
		super config
		
		# Basics
		@x = margin
		@width = Screen.width - margin * 2
		@height = 4
		@fill.backgroundColor = colors.primary
		@backgroundColor = colors.secondary
		@value = config.value
		@unitName = config.unit or ''

		@baseStyle = 
			fontFamily: "Roboto"
			fontWeight: 500
			fontSize: "26px"

		# Knob
		@knobSize = 24
		@knob.backgroundColor = colors.primary
		@knob.borderRadius = 30
		@knob.shadowColor = colors.background
		@knob.shadowBlur = 0
		@knob.shadowSpread = 6
		
		# Name label
		@txtLabel = new Layer
			parent: @
			name: "label"
			y: -50
			backgroundColor: ""
			html: config.label
			color: colors.primary
			style: @baseStyle
		
		@txtLabel.style.fontStyle = "italic"
		
		# Value label
		@txtValue = new Layer
			parent: @
			name: "value"
			maxX: @width
			y: -50
			backgroundColor: ""
			html: Math.round(@value) + ' ' + @unitName
			color: config.valueColor or colors.orange
			style: @baseStyle
		
		@txtValue.style.textAlign = "right"
		
		# Events

		@onValueChange ->
			@txtValue.html = Math.round(@value) + ' ' + @unitName
		
		@onTouchStart ->
			@knob.animate
				properties:
					scale: 1.4
		
		@onTouchEnd ->
			runAnim()
			@knob.animate
				properties:
					scale: 1



# Instantiate sliders
# --------------------------------------------------------------------------------

friction = new Slider
	label: "Friction"
	maxY: Screen.height - margin * 1.5
	min: 0
	max: 50
	value: 18

spring = new Slider
	label: "Spring"
	y: friction.y - margin * 2
	min: 0
	max: 200
	value: 150

speed = new Slider
	label: "Time"
	unit: "ms"
	valueColor: colors.blue
	y: spring.y - margin * 2
	min: 0
	max: 1000
	value: 200


