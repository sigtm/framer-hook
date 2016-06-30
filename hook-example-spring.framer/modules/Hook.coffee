###
--------------------------------------------------------------------------------
Hook module for Framer
--------------------------------------------------------------------------------

The Hook module simply expands the Layer prototype, and lets you make any
numeric Layer property follow another property - either its own or another
object's - via a spring or gravity attraction.


--------------------------------------------------------------------------------
Example: Layered animation (eased + spring)
--------------------------------------------------------------------------------

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

NOTE: 
To attach both the x and y position, use "pos", "midPos" or "maxPos" as the
property/targetProperty.


--------------------------------------------------------------------------------
Example: Hooking property to another layer
--------------------------------------------------------------------------------

target = new Layer
hooked = new Layer

hooked.hook
	property: "scale"
	to: target
	type: "spring(150, 15)"

The "hooked" layer's scale will now continuously follow the target layer's scale
with a spring animation.


--------------------------------------------------------------------------------
layer.hook(options)
--------------------------------------------------------------------------------

Options are passed as a single object, like you would for a new Layer.
The options object takes the following properties:


property [String]
-----------------
The property you'd like to hook onto another object's property


type [String]
-------------
Either "spring(strength, friction)" or "gravity(strength, drag)". Only the last
specified drag value is used for each property, since it is only applied to
each property once (and only if it has a gravity hook applied to it.)


to [Object] (Optional)
----------------------
The object to attach it to. Defaults to itself.


targetProperty [String] (Optional)
----------------------------------
Specify the target object's property to follow, if you don't want to follow
the same property that the hook is applied to.


modulator [Function] (Optional)
-------------------------------
The modulator function receives the target property's value, and lets you
modify it before it is fed into the physics calculations. Useful for anything
from standard Utils.modulate() type stuff to snapping and conditional values.


zoom [Number] (Optional)
------------------------
This factor defines the distance that 1px represents in regards to gravity and
drag calculations. Only one value is stored per layer, so specifying it
overwrites its existing value. Default is 100.


--------------------------------------------------------------------------------
layer.unHook(property, object)
--------------------------------------------------------------------------------

This removes all hooks for a given property and target object. Example:

# Hook it
layer.hook
	property: "x"
	to: "otherlayer"
	targetProperty: "y"
	type: "spring(200,20)"

# Unhook it
layer.unHook "x", otherlayer


--------------------------------------------------------------------------------
layer.onHookUpdate(delta)
--------------------------------------------------------------------------------

After a layer is done applying accelerations to its hooked properties, it calls
onHookUpdate() at the end of each frame, if it is defined. This is an easy way
to animate or trigger other stuff, perhaps based on your layer's updated
properties or velocities.

The delta value from the Framer loop is passed on to onHookUpdate() as well,
which is the time in seconds since the last animation frame.

Note that if you unhook all your hooks, onHookUpdate() will of course no longer
be called for that layer.

###


# Since older versions of Safari seem to be missing String.prototype.includes()

unless String.prototype.includes
	String::includes = (search, start) ->
		'use strict'
		start = 0 if typeof start is 'number'

		if start + search.length > this.length
			return false;
		else
			return @indexOf(search, start) isnt -1

# Expand layer

Layer::hook = (config) ->

	throw new Error 'layer.hook() needs a property, a hook type and either a target object or target property to work' unless config.property and config.type and (config.to or config.targetProperty)

	# Single array for all hooks, as opposed to nested arrays per property, because performance
	@hooks ?=
		hooks: []
		velocities: {}
		defs:
			zoom: 100
			getDrag: (velocity, drag, zoom) =>
				velocity /= zoom
				# Dividing by 10 is unscientific, but it means a value of 2 equals roughly a 100g ball with 15cm radius in air
				drag = -(drag / 10) * velocity * velocity * velocity / Math.abs(velocity)
				if _.isNaN(drag) then return 0 else return drag
			getGravity: (strength, distance, zoom) =>
				dist = Math.max(1, distance / zoom)
				return strength * zoom / (dist * dist)

	# Update the zoom value if given
	@hooks.zoom = config.zoom if config.zoom

	# Parse physics config string
	f = Utils.parseFunction config.type
	config.type = f.name
	config.strength = f.args[0]
	config.friction = f.args[1] or 0

	# Default to same targetProperty on same object (hopefully you've set at least one of these to something else)
	config.targetProperty ?= config.property
	config.to ?= @

	# All position accelerations are added to a single 'pos' velocity. Store actual properties so we don't have to do it again every frame

	if config.property.toLowerCase().includes 'pos'
		config.prop = 'pos'
		
		if config.property.toLowerCase().includes 'mid'
			config.thisX = 'midX'
			config.thisY = 'midY'
		
		else if config.property.toLowerCase().includes 'max'
			config.thisX = 'maxX'
			config.thisY = 'maxY'
		
		else
			config.thisX = 'x'
			config.thisY = 'y'
		
		if config.targetProperty.toLowerCase().includes 'mid'
			config.toX = 'midX'
			config.toY = 'midY'
		
		else if config.targetProperty.toLowerCase().includes 'max'
			config.toX = 'maxX'
			config.toY = 'maxY'		
		else
			config.toX = 'x'
			config.toY = 'y'
		
	else
		config.prop = config.property

	# Save hook to @hooks array	
	@hooks.hooks.push(config)

	# Create velocity property if necessary
	@hooks.velocities[config.prop] ?= if config.prop is 'pos' then { x: 0, y: 0 } else 0

	# Use Framer's animation loop, slightly more robust than requestAnimationFrame directly
	# Save the returned AnimationLoop reference to make sure @hookLoop isn't added multiple times per layer
	@hooks.emitter ?= Framer.Loop.on('render', @hookLoop, this)

Layer::unHook = (property, object) ->
	
	return unless @hooks

	prop = if property.toLowerCase().includes 'pos' then 'pos' else property

	# Remove all matches
	@hooks.hooks = @hooks.hooks.filter (hook) ->
		hook.to isnt object or hook.property isnt property

	# If there are no hooks left, shut it down
	if @hooks.hooks.length is 0
		delete @hooks
		Framer.Loop.removeListener 'render', @hookLoop
		return

	# Still here? Check if there are any remaining hooks affecting same velocity
	remaining = @hooks.hooks.filter (hook) ->
		prop is hook.prop
		
	# If not, delete velocity (otherwise it won't be reset if you make new hook for same property)
	delete @hooks.velocities[prop] if remaining.length is 0

Layer::hookLoop = (delta) ->

	if @hooks

		# Multiple hooks can affect the same property. Add accelerations to temporary object so the property's velocity is the same for all calculations within the same animation frame
		acceleration = {}
		
		# Save drag for each property to this object, since only most recently specified value is used for each property
		drag = {}
		
		# Add accelerations
		for hook in @hooks.hooks
		
			if hook.prop is 'pos'

				acceleration.pos ?= { x: 0, y: 0 }

				target = { x: hook.to[hook.toX], y: hook.to[hook.toY] }

				target = hook.modulator(target) if hook.modulator

				vector =
					x: target.x - @[hook.thisX]
					y: target.y - @[hook.thisY]
				
				vLength = Math.sqrt((vector.x * vector.x) + (vector.y * vector.y))

				if hook.type is 'spring'

					damper =
						x: -hook.friction * @hooks.velocities.pos.x
						y: -hook.friction * @hooks.velocities.pos.y

					vector.x *= hook.strength
					vector.y *= hook.strength
					
					acceleration.pos.x += (vector.x + damper.x) * delta
					acceleration.pos.y += (vector.y + damper.y) * delta
				
				else if hook.type is 'gravity'
				
					drag.pos = hook.friction
					
					gravity = @hooks.defs.getGravity(hook.strength, vLength, @hooks.defs.zoom)

					vector.x *= gravity / vLength
					vector.y *= gravity / vLength
					
					acceleration.pos.x += vector.x * delta
					acceleration.pos.y += vector.y * delta
									
			else
				
				acceleration[hook.prop] ?= 0

				target = hook.to[hook.targetProperty]

				target = hook.modulator(target) if hook.modulator

				vector = target - @[hook.prop]
				
				if hook.type is 'spring'

					force = vector * hook.strength
					damper = -hook.friction * @hooks.velocities[hook.prop]

					acceleration[hook.prop] += (force + damper) * delta

				
				else if hook.type is 'gravity'
	
					drag[hook.prop] = hook.friction
					
					force = @hooks.defs.getGravity(hook.strength, vector, @hooks.defs.zoom)
					
					acceleration[hook.prop] += force * delta
		
		
		# Add velocities to properties. Doing this at the end in case there are multiple hooks affecting the same velocity
		for prop, velocity of @hooks.velocities
		
			if prop is 'pos'

				# Add drag, if it exists
				if drag.pos
					velocity.x += @hooks.defs.getDrag(velocity.x, drag.pos, @hooks.defs.zoom)
					velocity.y += @hooks.defs.getDrag(velocity.y, drag.pos, @hooks.defs.zoom)
					
				# Add acceleration to velocity
				velocity.x += acceleration.pos.x
				velocity.y += acceleration.pos.y
				
				# Add velocity to position
				@x += velocity.x * delta
				@y += velocity.y * delta
			
			else
			
				# Add drag, if it exists
				if drag[prop]
					@hooks.velocities[prop] += @hooks.defs.getDrag(@hooks.velocities[prop], drag[prop], @hooks.defs.zoom)
				
				# Add acceleration to velocity
				@hooks.velocities[prop] += acceleration[prop]
				
				# Add velocity to property
				@[prop] += @hooks.velocities[prop] * delta

		@onHookUpdate?(delta)