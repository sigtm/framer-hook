###

Hook example
--------------

The Hook module simply expands the Layer prototype, and lets you make any
numeric Layer property follow a property on another object via a spring or a
gravity attraction. Check the comments in modules/Hook.coffee for a more thorough
documentation.

###



# Require Hook. No exports, it just adds methods to the Layer prototype
# --------------------------------------------------------------------------------

require "Hook"



# Import sketch file
# --------------------------------------------------------------------------------
sketch = Framer.Importer.load("imported/app@2x")
Utils.globalLayers(sketch)



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

# Make the page layer draggable
page.draggable.enabled = true
page.draggable.horizontal = false
page.draggable.constraints =  { height: Screen.height }
page.draggable.bounceOptions.tension = 400

# Make the spinner layer
spinner = new Layer
	index: 0
	x: Align.center
	midY: 40
	width: 96
	height: 96
	borderRadius: 40
	image: "images/spinner.svg"

# Attach the spinner's scale to the page's y property
spinner.hook
	property: "scale"
	to: page
	targetProperty: "y"
	type: "spring(200,10)"
	
	# Add a modulator function, since we don't want the scale to be the same as page.y
	modulator: (inputvalue) ->
		
		# If page.y is under 300, translate to a scale between 0.5 and 0.75
		if inputvalue < 300
			return Utils.modulate(inputvalue, [0, 400], [0.5, 0.75])
			
		# Otherwise, snap to 1
		else
			return 1

# Now attach spinner.midY to page.y with similar conditional modulation
spinner.hook
	property: "midY"
	to: page
	targetProperty: "y"
	type: "spring(100,8)"
	modulator: (inputvalue) ->
		if inputvalue < 300
			inputvalue / 6 + 40
		else
			inputvalue / 2

# onHookUpdate() is called at the end of each frame, after all of the layer's hooks are applied
# It receives the delta value from the Framer loop, which is the time in seconds since the last frame
spinner.onHookUpdate = (delta) ->
	if page.y < 300
		@doSpin = false
		@opacity = 0.2
		@rotation = page.y / 2
	else
		@doSpin = true
		@opacity = 1
		@rotation += delta * 300 if spinner.doSpin