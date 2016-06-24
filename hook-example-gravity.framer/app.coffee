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



# Settings
# --------------------------------------------------------------------------------

gravity = 200
drag = 2
burstSize = 20

colors =
	background: "#260355"
	orange: "#f90"
	blue: "#63ffff"
	primary: "white"
	secondary: "rgba(255,255,255,0.1)"

easeInOut = "cubic-bezier(0.2, 0, 0.4, 1)"



# Set background and defaults
# --------------------------------------------------------------------------------

Framer.Device.viewport.backgroundColor = colors.background

Framer.Defaults.Animation =
	curve: easeInOut
	time: 0.05



# Set up example
# --------------------------------------------------------------------------------

magnet = new Layer
	borderRadius: 100
	backgroundColor: colors.primary
	width: 80
	height: 80

magnet.center()

magnet.draggable.enabled = true

magnet.onTouchStart ->
	
	@animate
		properties:
			scale: 0.95
	
	for i in [0...burstSize]
		
		bubble = new Layer
			x: @midX
			y: @midY
			index: 0
			borderRadius: 5
			backgroundColor: if (i % 2) then colors.blue else colors.orange
			width: 10
			height: 10
		
		bubble.hook
			property: 'midPos'
			to: magnet
			type: 'gravity(' + gravity + ',' + drag + ')'
		
		initialAngle = Math.random() * Math.PI * 2
		
		bubble.hooks.velocities.pos.x += Math.cos(initialAngle) * 3000
		bubble.hooks.velocities.pos.y += Math.sin(initialAngle) * 3000


magnet.onTouchEnd ->
	@animate
		properties:
			scale: 1
