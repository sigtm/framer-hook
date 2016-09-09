require=(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({"Hook":[function(require,module,exports){

/*
--------------------------------------------------------------------------------
Hook module for Framer
--------------------------------------------------------------------------------

by:      Sigurd Mannsåker
github:  https://github.com/sigtm/framer-hook

················································································


The Hook module simply expands the Layer prototype, and lets you make any
numeric Layer property follow another property - either its own or another
object's - via a spring or gravity attraction.


--------------------------------------------------------------------------------
Example: Layered animation (eased + spring)
--------------------------------------------------------------------------------

myLayer = new Layer

 * Make our own custom property for the x property to follow
myLayer.easedX = 0

 * Hook x to easedX via a spring
myLayer.hook
	property: "x"
	targetProperty: "easedX"
	type: "spring(150, 15)"

 * Animate easedX
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

 * Hook it
layer.hook
	property: "x"
	to: "otherlayer"
	targetProperty: "y"
	type: "spring(200,20)"

 * Unhook it
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
 */
if (!String.prototype.includes) {
  String.prototype.includes = function(search, start) {
    'use strict';
    if (typeof start === 'number') {
      start = 0;
    }
    if (start + search.length > this.length) {
      return false;
    } else {
      return this.indexOf(search, start) !== -1;
    }
  };
}

Layer.prototype.hook = function(config) {
  var base, base1, f, name;
  if (!(config.property && config.type && (config.to || config.targetProperty))) {
    throw new Error('layer.hook() needs a property, a hook type and either a target object or target property to work');
  }
  if (this.hooks == null) {
    this.hooks = {
      hooks: [],
      velocities: {},
      defs: {
        zoom: 100,
        getDrag: (function(_this) {
          return function(velocity, drag, zoom) {
            velocity /= zoom;
            drag = -(drag / 10) * velocity * velocity * velocity / Math.abs(velocity);
            if (_.isNaN(drag)) {
              return 0;
            } else {
              return drag;
            }
          };
        })(this),
        getGravity: (function(_this) {
          return function(strength, distance, zoom) {
            var dist;
            dist = Math.max(1, distance / zoom);
            return strength * zoom / (dist * dist);
          };
        })(this)
      }
    };
  }
  if (config.zoom) {
    this.hooks.zoom = config.zoom;
  }
  f = Utils.parseFunction(config.type);
  config.type = f.name;
  config.strength = f.args[0];
  config.friction = f.args[1] || 0;
  if (config.targetProperty == null) {
    config.targetProperty = config.property;
  }
  if (config.to == null) {
    config.to = this;
  }
  if (config.property.toLowerCase().includes('pos')) {
    config.prop = 'pos';
    if (config.property.toLowerCase().includes('mid')) {
      config.thisX = 'midX';
      config.thisY = 'midY';
    } else if (config.property.toLowerCase().includes('max')) {
      config.thisX = 'maxX';
      config.thisY = 'maxY';
    } else {
      config.thisX = 'x';
      config.thisY = 'y';
    }
    if (config.targetProperty.toLowerCase().includes('mid')) {
      config.toX = 'midX';
      config.toY = 'midY';
    } else if (config.targetProperty.toLowerCase().includes('max')) {
      config.toX = 'maxX';
      config.toY = 'maxY';
    } else {
      config.toX = 'x';
      config.toY = 'y';
    }
  } else {
    config.prop = config.property;
  }
  this.hooks.hooks.push(config);
  if ((base = this.hooks.velocities)[name = config.prop] == null) {
    base[name] = config.prop === 'pos' ? {
      x: 0,
      y: 0
    } : 0;
  }
  return (base1 = this.hooks).emitter != null ? base1.emitter : base1.emitter = Framer.Loop.on('render', this.hookLoop, this);
};

Layer.prototype.unHook = function(property, object) {
  var prop, remaining;
  if (!this.hooks) {
    return;
  }
  prop = property.toLowerCase().includes('pos') ? 'pos' : property;
  this.hooks.hooks = this.hooks.hooks.filter(function(hook) {
    return hook.to !== object || hook.property !== property;
  });
  if (this.hooks.hooks.length === 0) {
    delete this.hooks;
    Framer.Loop.removeListener('render', this.hookLoop);
    return;
  }
  remaining = this.hooks.hooks.filter(function(hook) {
    return prop === hook.prop;
  });
  if (remaining.length === 0) {
    return delete this.hooks.velocities[prop];
  }
};

Layer.prototype.hookLoop = function(delta) {
  var acceleration, damper, drag, force, gravity, hook, i, len, name, prop, ref, ref1, target, vLength, vector, velocity;
  if (this.hooks) {
    acceleration = {};
    drag = {};
    ref = this.hooks.hooks;
    for (i = 0, len = ref.length; i < len; i++) {
      hook = ref[i];
      if (hook.prop === 'pos') {
        if (acceleration.pos == null) {
          acceleration.pos = {
            x: 0,
            y: 0
          };
        }
        target = {
          x: hook.to[hook.toX],
          y: hook.to[hook.toY]
        };
        if (hook.modulator) {
          target = hook.modulator(target);
        }
        vector = {
          x: target.x - this[hook.thisX],
          y: target.y - this[hook.thisY]
        };
        vLength = Math.sqrt((vector.x * vector.x) + (vector.y * vector.y));
        if (hook.type === 'spring') {
          damper = {
            x: -hook.friction * this.hooks.velocities.pos.x,
            y: -hook.friction * this.hooks.velocities.pos.y
          };
          vector.x *= hook.strength;
          vector.y *= hook.strength;
          acceleration.pos.x += (vector.x + damper.x) * delta;
          acceleration.pos.y += (vector.y + damper.y) * delta;
        } else if (hook.type === 'gravity') {
          drag.pos = hook.friction;
          gravity = this.hooks.defs.getGravity(hook.strength, vLength, this.hooks.defs.zoom);
          vector.x *= gravity / vLength;
          vector.y *= gravity / vLength;
          acceleration.pos.x += vector.x * delta;
          acceleration.pos.y += vector.y * delta;
        }
      } else {
        if (acceleration[name = hook.prop] == null) {
          acceleration[name] = 0;
        }
        target = hook.to[hook.targetProperty];
        if (hook.modulator) {
          target = hook.modulator(target);
        }
        vector = target - this[hook.prop];
        if (hook.type === 'spring') {
          force = vector * hook.strength;
          damper = -hook.friction * this.hooks.velocities[hook.prop];
          acceleration[hook.prop] += (force + damper) * delta;
        } else if (hook.type === 'gravity') {
          drag[hook.prop] = hook.friction;
          force = this.hooks.defs.getGravity(hook.strength, vector, this.hooks.defs.zoom);
          acceleration[hook.prop] += force * delta;
        }
      }
    }
    ref1 = this.hooks.velocities;
    for (prop in ref1) {
      velocity = ref1[prop];
      if (prop === 'pos') {
        if (drag.pos) {
          velocity.x += this.hooks.defs.getDrag(velocity.x, drag.pos, this.hooks.defs.zoom);
          velocity.y += this.hooks.defs.getDrag(velocity.y, drag.pos, this.hooks.defs.zoom);
        }
        velocity.x += acceleration.pos.x;
        velocity.y += acceleration.pos.y;
        this.x += velocity.x * delta;
        this.y += velocity.y * delta;
      } else {
        if (drag[prop]) {
          this.hooks.velocities[prop] += this.hooks.defs.getDrag(this.hooks.velocities[prop], drag[prop], this.hooks.defs.zoom);
        }
        this.hooks.velocities[prop] += acceleration[prop];
        this[prop] += this.hooks.velocities[prop] * delta;
      }
    }
    return typeof this.onHookUpdate === "function" ? this.onHookUpdate(delta) : void 0;
  }
};


},{}]},{},[])
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVXNlcnMvc2lndXJkL1JlcG9zL2ZyYW1lci1ob29rL2hvb2stZXhhbXBsZS1ncmF2aXR5LmZyYW1lci9tb2R1bGVzL0hvb2suY29mZmVlIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOztBQ0FBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBNklBLElBQUEsQ0FBTyxNQUFNLENBQUMsU0FBUyxDQUFDLFFBQXhCO0VBQ0MsTUFBTSxDQUFBLFNBQUUsQ0FBQSxRQUFSLEdBQW1CLFNBQUMsTUFBRCxFQUFTLEtBQVQ7SUFDbEI7SUFDQSxJQUFhLE9BQU8sS0FBUCxLQUFnQixRQUE3QjtNQUFBLEtBQUEsR0FBUSxFQUFSOztJQUVBLElBQUcsS0FBQSxHQUFRLE1BQU0sQ0FBQyxNQUFmLEdBQXdCLElBQUksQ0FBQyxNQUFoQztBQUNDLGFBQU8sTUFEUjtLQUFBLE1BQUE7QUFHQyxhQUFPLElBQUMsQ0FBQSxPQUFELENBQVMsTUFBVCxFQUFpQixLQUFqQixDQUFBLEtBQTZCLENBQUMsRUFIdEM7O0VBSmtCLEVBRHBCOzs7QUFZQSxLQUFLLENBQUEsU0FBRSxDQUFBLElBQVAsR0FBYyxTQUFDLE1BQUQ7QUFFYixNQUFBO0VBQUEsSUFBQSxDQUFBLENBQTBILE1BQU0sQ0FBQyxRQUFQLElBQW9CLE1BQU0sQ0FBQyxJQUEzQixJQUFvQyxDQUFDLE1BQU0sQ0FBQyxFQUFQLElBQWEsTUFBTSxDQUFDLGNBQXJCLENBQTlKLENBQUE7QUFBQSxVQUFVLElBQUEsS0FBQSxDQUFNLGtHQUFOLEVBQVY7OztJQUdBLElBQUMsQ0FBQSxRQUNBO01BQUEsS0FB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QUssQ0FBQyxJQUFJLENBQUMsSUFBdEQsRUFGZjs7UUFLQSxRQUFRLENBQUMsQ0FBVCxJQUFjLFlBQVksQ0FBQyxHQUFHLENBQUM7UUFDL0IsUUFBUSxDQUFDLENBQVQsSUFBYyxZQUFZLENBQUMsR0FBRyxDQUFDO1FBRy9CLElBQUMsQ0FBQSxDQUFELElBQU0sUUFBUSxDQUFDLENBQVQsR0FBYTtRQUNuQixJQUFDLENBQUEsQ0FBRCxJQUFNLFFBQVEsQ0FBQyxDQUFULEdBQWEsTUFicEI7T0FBQSxNQUFBO1FBa0JDLElBQUcsSUFBSyxDQUFBLElBQUEsQ0FBUjtVQUNDLElBQUMsQ0FBQSxLQUFLLENBQUMsVUFBVyxDQUFBLElBQUEsQ0FBbEIsSUFBMkIsSUFBQyxDQUFBLEtBQUssQ0FBQyxJQUFJLENBQUMsT0FBWixDQUFvQixJQUFDLENBQUEsS0FBSyxDQUFDLFVBQVcsQ0FBQSxJQUFBLENBQXRDLEVBQTZDLElBQUssQ0FBQSxJQUFBLENBQWxELEVBQXlELElBQUMsQ0FBQSxLQUFLLENBQUMsSUFBSSxDQUFDLElBQXJFLEVBRDVCOztRQUlBLElBQUMsQ0FBQSxLQUFLLENBQUMsVUFBVyxDQUFBLElBQUEsQ0FBbEIsSUFBMkIsWUFBYSxDQUFBLElBQUE7UUFHeEMsSUFBRSxDQUFBLElBQUEsQ0FBRixJQUFXLElBQUMsQ0FBQSxLQUFLLENBQUMsVUFBVyxDQUFBLElBQUEsQ0FBbEIsR0FBMEIsTUF6QnRDOztBQUZEO3FEQTZCQSxJQUFDLENBQUEsYUFBYyxnQkExR2hCOztBQUZpQiIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIjIyNcbi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5Ib29rIG1vZHVsZSBmb3IgRnJhbWVyXG4tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5ieTogICAgICBTaWd1cmQgTWFubnPDpWtlclxuZ2l0aHViOiAgaHR0cHM6Ly9naXRodWIuY29tL3NpZ3RtL2ZyYW1lci1ob29rXG5cbsK3wrfCt8K3wrfCt8K3wrfCt8K3wrfCt8K3wrfCt8K3wrfCt8K3wrfCt8K3wrfCt8K3wrfCt8K3wrfCt8K3wrfCt8K3wrfCt8K3wrfCt8K3wrfCt8K3wrfCt8K3wrfCt8K3wrfCt8K3wrfCt8K3wrfCt8K3wrfCt8K3wrfCt8K3wrfCt8K3wrfCt8K3wrfCt8K3wrfCt8K3wrfCt8K3wrdcblxuXG5UaGUgSG9vayBtb2R1bGUgc2ltcGx5IGV4cGFuZHMgdGhlIExheWVyIHByb3RvdHlwZSwgYW5kIGxldHMgeW91IG1ha2UgYW55XG5udW1lcmljIExheWVyIHByb3BlcnR5IGZvbGxvdyBhbm90aGVyIHByb3BlcnR5IC0gZWl0aGVyIGl0cyBvd24gb3IgYW5vdGhlclxub2JqZWN0J3MgLSB2aWEgYSBzcHJpbmcgb3IgZ3Jhdml0eSBhdHRyYWN0aW9uLlxuXG5cbi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5FeGFtcGxlOiBMYXllcmVkIGFuaW1hdGlvbiAoZWFzZWQgKyBzcHJpbmcpXG4tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5teUxheWVyID0gbmV3IExheWVyXG5cbiMgTWFrZSBvdXIgb3duIGN1c3RvbSBwcm9wZXJ0eSBmb3IgdGhlIHggcHJvcGVydHkgdG8gZm9sbG93XG5teUxheWVyLmVhc2VkWCA9IDBcblxuIyBIb29rIHggdG8gZWFzZWRYIHZpYSBhIHNwcmluZ1xubXlMYXllci5ob29rXG5cdHByb3BlcnR5OiBcInhcIlxuXHR0YXJnZXRQcm9wZXJ0eTogXCJlYXNlZFhcIlxuXHR0eXBlOiBcInNwcmluZygxNTAsIDE1KVwiXG5cbiMgQW5pbWF0ZSBlYXNlZFhcbm15TGF5ZXIuYW5pbWF0ZVxuXHRwcm9wZXJ0aWVzOlxuXHRcdGVhc2VkWDogMjAwXG5cdHRpbWU6IDAuMTVcblx0Y3VydmU6IFwiY3ViaWMtYmV6aWVyKDAuMiwgMCwgMC40LCAxKVwiXG5cbk5PVEU6IFxuVG8gYXR0YWNoIGJvdGggdGhlIHggYW5kIHkgcG9zaXRpb24sIHVzZSBcInBvc1wiLCBcIm1pZFBvc1wiIG9yIFwibWF4UG9zXCIgYXMgdGhlXG5wcm9wZXJ0eS90YXJnZXRQcm9wZXJ0eS5cblxuXG4tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuRXhhbXBsZTogSG9va2luZyBwcm9wZXJ0eSB0byBhbm90aGVyIGxheWVyXG4tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG50YXJnZXQgPSBuZXcgTGF5ZXJcbmhvb2tlZCA9IG5ldyBMYXllclxuXG5ob29rZWQuaG9va1xuXHRwcm9wZXJ0eTogXCJzY2FsZVwiXG5cdHRvOiB0YXJnZXRcblx0dHlwZTogXCJzcHJpbmcoMTUwLCAxNSlcIlxuXG5UaGUgXCJob29rZWRcIiBsYXllcidzIHNjYWxlIHdpbGwgbm93IGNvbnRpbnVvdXNseSBmb2xsb3cgdGhlIHRhcmdldCBsYXllcidzIHNjYWxlXG53aXRoIGEgc3ByaW5nIGFuaW1hdGlvbi5cblxuXG4tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxubGF5ZXIuaG9vayhvcHRpb25zKVxuLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuT3B0aW9ucyBhcmUgcGFzc2VkIGFzIGEgc2luZ2xlIG9iamVjdCwgbGlrZSB5b3Ugd291bGQgZm9yIGEgbmV3IExheWVyLlxuVGhlIG9wdGlvbnMgb2JqZWN0IHRha2VzIHRoZSBmb2xsb3dpbmcgcHJvcGVydGllczpcblxuXG5wcm9wZXJ0eSBbU3RyaW5nXVxuLS0tLS0tLS0tLS0tLS0tLS1cblRoZSBwcm9wZXJ0eSB5b3UnZCBsaWtlIHRvIGhvb2sgb250byBhbm90aGVyIG9iamVjdCdzIHByb3BlcnR5XG5cblxudHlwZSBbU3RyaW5nXVxuLS0tLS0tLS0tLS0tLVxuRWl0aGVyIFwic3ByaW5nKHN0cmVuZ3RoLCBmcmljdGlvbilcIiBvciBcImdyYXZpdHkoc3RyZW5ndGgsIGRyYWcpXCIuIE9ubHkgdGhlIGxhc3RcbnNwZWNpZmllZCBkcmFnIHZhbHVlIGlzIHVzZWQgZm9yIGVhY2ggcHJvcGVydHksIHNpbmNlIGl0IGlzIG9ubHkgYXBwbGllZCB0b1xuZWFjaCBwcm9wZXJ0eSBvbmNlIChhbmQgb25seSBpZiBpdCBoYXMgYSBncmF2aXR5IGhvb2sgYXBwbGllZCB0byBpdC4pXG5cblxudG8gW09iamVjdF0gKE9wdGlvbmFsKVxuLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuVGhlIG9iamVjdCB0byBhdHRhY2ggaXQgdG8uIERlZmF1bHRzIHRvIGl0c2VsZi5cblxuXG50YXJnZXRQcm9wZXJ0eSBbU3RyaW5nXSAoT3B0aW9uYWwpXG4tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5TcGVjaWZ5IHRoZSB0YXJnZXQgb2JqZWN0J3MgcHJvcGVydHkgdG8gZm9sbG93LCBpZiB5b3UgZG9uJ3Qgd2FudCB0byBmb2xsb3dcbnRoZSBzYW1lIHByb3BlcnR5IHRoYXQgdGhlIGhvb2sgaXMgYXBwbGllZCB0by5cblxuXG5tb2R1bGF0b3IgW0Z1bmN0aW9uXSAoT3B0aW9uYWwpXG4tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5UaGUgbW9kdWxhdG9yIGZ1bmN0aW9uIHJlY2VpdmVzIHRoZSB0YXJnZXQgcHJvcGVydHkncyB2YWx1ZSwgYW5kIGxldHMgeW91XG5tb2RpZnkgaXQgYmVmb3JlIGl0IGlzIGZlZCBpbnRvIHRoZSBwaHlzaWNzIGNhbGN1bGF0aW9ucy4gVXNlZnVsIGZvciBhbnl0aGluZ1xuZnJvbSBzdGFuZGFyZCBVdGlscy5tb2R1bGF0ZSgpIHR5cGUgc3R1ZmYgdG8gc25hcHBpbmcgYW5kIGNvbmRpdGlvbmFsIHZhbHVlcy5cblxuXG56b29tIFtOdW1iZXJdIChPcHRpb25hbClcbi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuVGhpcyBmYWN0b3IgZGVmaW5lcyB0aGUgZGlzdGFuY2UgdGhhdCAxcHggcmVwcmVzZW50cyBpbiByZWdhcmRzIHRvIGdyYXZpdHkgYW5kXG5kcmFnIGNhbGN1bGF0aW9ucy4gT25seSBvbmUgdmFsdWUgaXMgc3RvcmVkIHBlciBsYXllciwgc28gc3BlY2lmeWluZyBpdFxub3ZlcndyaXRlcyBpdHMgZXhpc3RpbmcgdmFsdWUuIERlZmF1bHQgaXMgMTAwLlxuXG5cbi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5sYXllci51bkhvb2socHJvcGVydHksIG9iamVjdClcbi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cblRoaXMgcmVtb3ZlcyBhbGwgaG9va3MgZm9yIGEgZ2l2ZW4gcHJvcGVydHkgYW5kIHRhcmdldCBvYmplY3QuIEV4YW1wbGU6XG5cbiMgSG9vayBpdFxubGF5ZXIuaG9va1xuXHRwcm9wZXJ0eTogXCJ4XCJcblx0dG86IFwib3RoZXJsYXllclwiXG5cdHRhcmdldFByb3BlcnR5OiBcInlcIlxuXHR0eXBlOiBcInNwcmluZygyMDAsMjApXCJcblxuIyBVbmhvb2sgaXRcbmxheWVyLnVuSG9vayBcInhcIiwgb3RoZXJsYXllclxuXG5cbi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5sYXllci5vbkhvb2tVcGRhdGUoZGVsdGEpXG4tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5BZnRlciBhIGxheWVyIGlzIGRvbmUgYXBwbHlpbmcgYWNjZWxlcmF0aW9ucyB0byBpdHMgaG9va2VkIHByb3BlcnRpZXMsIGl0IGNhbGxzXG5vbkhvb2tVcGRhdGUoKSBhdCB0aGUgZW5kIG9mIGVhY2ggZnJhbWUsIGlmIGl0IGlzIGRlZmluZWQuIFRoaXMgaXMgYW4gZWFzeSB3YXlcbnRvIGFuaW1hdGUgb3IgdHJpZ2dlciBvdGhlciBzdHVmZiwgcGVyaGFwcyBiYXNlZCBvbiB5b3VyIGxheWVyJ3MgdXBkYXRlZFxucHJvcGVydGllcyBvciB2ZWxvY2l0aWVzLlxuXG5UaGUgZGVsdGEgdmFsdWUgZnJvbSB0aGUgRnJhbWVyIGxvb3AgaXMgcGFzc2VkIG9uIHRvIG9uSG9va1VwZGF0ZSgpIGFzIHdlbGwsXG53aGljaCBpcyB0aGUgdGltZSBpbiBzZWNvbmRzIHNpbmNlIHRoZSBsYXN0IGFuaW1hdGlvbiBmcmFtZS5cblxuTm90ZSB0aGF0IGlmIHlvdSB1bmhvb2sgYWxsIHlvdXIgaG9va3MsIG9uSG9va1VwZGF0ZSgpIHdpbGwgb2YgY291cnNlIG5vIGxvbmdlclxuYmUgY2FsbGVkIGZvciB0aGF0IGxheWVyLlxuXG4jIyNcblxuXG4jIFNpbmNlIG9sZGVyIHZlcnNpb25zIG9mIFNhZmFyaSBzZWVtIHRvIGJlIG1pc3NpbmcgU3RyaW5nLnByb3RvdHlwZS5pbmNsdWRlcygpXG5cbnVubGVzcyBTdHJpbmcucHJvdG90eXBlLmluY2x1ZGVzXG5cdFN0cmluZzo6aW5jbHVkZXMgPSAoc2VhcmNoLCBzdGFydCkgLT5cblx0XHQndXNlIHN0cmljdCdcblx0XHRzdGFydCA9IDAgaWYgdHlwZW9mIHN0YXJ0IGlzICdudW1iZXInXG5cblx0XHRpZiBzdGFydCArIHNlYXJjaC5sZW5ndGggPiB0aGlzLmxlbmd0aFxuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdGVsc2Vcblx0XHRcdHJldHVybiBAaW5kZXhPZihzZWFyY2gsIHN0YXJ0KSBpc250IC0xXG5cbiMgRXhwYW5kIGxheWVyXG5cbkxheWVyOjpob29rID0gKGNvbmZpZykgLT5cblxuXHR0aHJvdyBuZXcgRXJyb3IgJ2xheWVyLmhvb2soKSBuZWVkcyBhIHByb3BlcnR5LCBhIGhvb2sgdHlwZSBhbmQgZWl0aGVyIGEgdGFyZ2V0IG9iamVjdCBvciB0YXJnZXQgcHJvcGVydHkgdG8gd29yaycgdW5sZXNzIGNvbmZpZy5wcm9wZXJ0eSBhbmQgY29uZmlnLnR5cGUgYW5kIChjb25maWcudG8gb3IgY29uZmlnLnRhcmdldFByb3BlcnR5KVxuXG5cdCMgU2luZ2xlIGFycmF5IGZvciBhbGwgaG9va3MsIGFzIG9wcG9zZWQgdG8gbmVzdGVkIGFycmF5cyBwZXIgcHJvcGVydHksIGJlY2F1c2UgcGVyZm9ybWFuY2Vcblx0QGhvb2tzID89XG5cdFx0aG9va3M6IFtdXG5cdFx0dmVsb2NpdGllczoge31cblx0XHRkZWZzOlxuXHRcdFx0em9vbTogMTAwXG5cdFx0XHRnZXREcmFnOiAodmVsb2NpdHksIGRyYWcsIHpvb20pID0+XG5cdFx0XHRcdHZlbG9jaXR5IC89IHpvb21cblx0XHRcdFx0IyBEaXZpZGluZyBieSAxMCBpcyB1bnNjaWVudGlmaWMsIGJ1dCBpdCBtZWFucyBhIHZhbHVlIG9mIDIgZXF1YWxzIHJvdWdobHkgYSAxMDBnIGJhbGwgd2l0aCAxNWNtIHJhZGl1cyBpbiBhaXJcblx0XHRcdFx0ZHJhZyA9IC0oZHJhZyAvIDEwKSAqIHZlbG9jaXR5ICogdmVsb2NpdHkgKiB2ZWxvY2l0eSAvIE1hdGguYWJzKHZlbG9jaXR5KVxuXHRcdFx0XHRpZiBfLmlzTmFOKGRyYWcpIHRoZW4gcmV0dXJuIDAgZWxzZSByZXR1cm4gZHJhZ1xuXHRcdFx0Z2V0R3Jhdml0eTogKHN0cmVuZ3RoLCBkaXN0YW5jZSwgem9vbSkgPT5cblx0XHRcdFx0ZGlzdCA9IE1hdGgubWF4KDEsIGRpc3RhbmNlIC8gem9vbSlcblx0XHRcdFx0cmV0dXJuIHN0cmVuZ3RoICogem9vbSAvIChkaXN0ICogZGlzdClcblxuXHQjIFVwZGF0ZSB0aGUgem9vbSB2YWx1ZSBpZiBnaXZlblxuXHRAaG9va3Muem9vbSA9IGNvbmZpZy56b29tIGlmIGNvbmZpZy56b29tXG5cblx0IyBQYXJzZSBwaHlzaWNzIGNvbmZpZyBzdHJpbmdcblx0ZiA9IFV0aWxzLnBhcnNlRnVuY3Rpb24gY29uZmlnLnR5cGVcblx0Y29uZmlnLnR5cGUgPSBmLm5hbWVcblx0Y29uZmlnLnN0cmVuZ3RoID0gZi5hcmdzWzBdXG5cdGNvbmZpZy5mcmljdGlvbiA9IGYuYXJnc1sxXSBvciAwXG5cblx0IyBEZWZhdWx0IHRvIHNhbWUgdGFyZ2V0UHJvcGVydHkgb24gc2FtZSBvYmplY3QgKGhvcGVmdWxseSB5b3UndmUgc2V0IGF0IGxlYXN0IG9uZSBvZiB0aGVzZSB0byBzb21ldGhpbmcgZWxzZSlcblx0Y29uZmlnLnRhcmdldFByb3BlcnR5ID89IGNvbmZpZy5wcm9wZXJ0eVxuXHRjb25maWcudG8gPz0gQFxuXG5cdCMgQWxsIHBvc2l0aW9uIGFjY2VsZXJhdGlvbnMgYXJlIGFkZGVkIHRvIGEgc2luZ2xlICdwb3MnIHZlbG9jaXR5LiBTdG9yZSBhY3R1YWwgcHJvcGVydGllcyBzbyB3ZSBkb24ndCBoYXZlIHRvIGRvIGl0IGFnYWluIGV2ZXJ5IGZyYW1lXG5cblx0aWYgY29uZmlnLnByb3BlcnR5LnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMgJ3Bvcydcblx0XHRjb25maWcucHJvcCA9ICdwb3MnXG5cdFx0XG5cdFx0aWYgY29uZmlnLnByb3BlcnR5LnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMgJ21pZCdcblx0XHRcdGNvbmZpZy50aGlzWCA9ICdtaWRYJ1xuXHRcdFx0Y29uZmlnLnRoaXNZID0gJ21pZFknXG5cdFx0XG5cdFx0ZWxzZSBpZiBjb25maWcucHJvcGVydHkudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyAnbWF4J1xuXHRcdFx0Y29uZmlnLnRoaXNYID0gJ21heFgnXG5cdFx0XHRjb25maWcudGhpc1kgPSAnbWF4WSdcblx0XHRcblx0XHRlbHNlXG5cdFx0XHRjb25maWcudGhpc1ggPSAneCdcblx0XHRcdGNvbmZpZy50aGlzWSA9ICd5J1xuXHRcdFxuXHRcdGlmIGNvbmZpZy50YXJnZXRQcm9wZXJ0eS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzICdtaWQnXG5cdFx0XHRjb25maWcudG9YID0gJ21pZFgnXG5cdFx0XHRjb25maWcudG9ZID0gJ21pZFknXG5cdFx0XG5cdFx0ZWxzZSBpZiBjb25maWcudGFyZ2V0UHJvcGVydHkudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyAnbWF4J1xuXHRcdFx0Y29uZmlnLnRvWCA9ICdtYXhYJ1xuXHRcdFx0Y29uZmlnLnRvWSA9ICdtYXhZJ1x0XHRcblx0XHRlbHNlXG5cdFx0XHRjb25maWcudG9YID0gJ3gnXG5cdFx0XHRjb25maWcudG9ZID0gJ3knXG5cdFx0XG5cdGVsc2Vcblx0XHRjb25maWcucHJvcCA9IGNvbmZpZy5wcm9wZXJ0eVxuXG5cdCMgU2F2ZSBob29rIHRvIEBob29rcyBhcnJheVx0XG5cdEBob29rcy5ob29rcy5wdXNoKGNvbmZpZylcblxuXHQjIENyZWF0ZSB2ZWxvY2l0eSBwcm9wZXJ0eSBpZiBuZWNlc3Nhcnlcblx0QGhvb2tzLnZlbG9jaXRpZXNbY29uZmlnLnByb3BdID89IGlmIGNvbmZpZy5wcm9wIGlzICdwb3MnIHRoZW4geyB4OiAwLCB5OiAwIH0gZWxzZSAwXG5cblx0IyBVc2UgRnJhbWVyJ3MgYW5pbWF0aW9uIGxvb3AsIHNsaWdodGx5IG1vcmUgcm9idXN0IHRoYW4gcmVxdWVzdEFuaW1hdGlvbkZyYW1lIGRpcmVjdGx5XG5cdCMgU2F2ZSB0aGUgcmV0dXJuZWQgQW5pbWF0aW9uTG9vcCByZWZlcmVuY2UgdG8gbWFrZSBzdXJlIEBob29rTG9vcCBpc24ndCBhZGRlZCBtdWx0aXBsZSB0aW1lcyBwZXIgbGF5ZXJcblx0QGhvb2tzLmVtaXR0ZXIgPz0gRnJhbWVyLkxvb3Aub24oJ3JlbmRlcicsIEBob29rTG9vcCwgdGhpcylcblxuTGF5ZXI6OnVuSG9vayA9IChwcm9wZXJ0eSwgb2JqZWN0KSAtPlxuXHRcblx0cmV0dXJuIHVubGVzcyBAaG9va3NcblxuXHRwcm9wID0gaWYgcHJvcGVydHkudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyAncG9zJyB0aGVuICdwb3MnIGVsc2UgcHJvcGVydHlcblxuXHQjIFJlbW92ZSBhbGwgbWF0Y2hlc1xuXHRAaG9va3MuaG9va3MgPSBAaG9va3MuaG9va3MuZmlsdGVyIChob29rKSAtPlxuXHRcdGhvb2sudG8gaXNudCBvYmplY3Qgb3IgaG9vay5wcm9wZXJ0eSBpc250IHByb3BlcnR5XG5cblx0IyBJZiB0aGVyZSBhcmUgbm8gaG9va3MgbGVmdCwgc2h1dCBpdCBkb3duXG5cdGlmIEBob29rcy5ob29rcy5sZW5ndGggaXMgMFxuXHRcdGRlbGV0ZSBAaG9va3Ncblx0XHRGcmFtZXIuTG9vcC5yZW1vdmVMaXN0ZW5lciAncmVuZGVyJywgQGhvb2tMb29wXG5cdFx0cmV0dXJuXG5cblx0IyBTdGlsbCBoZXJlPyBDaGVjayBpZiB0aGVyZSBhcmUgYW55IHJlbWFpbmluZyBob29rcyBhZmZlY3Rpbmcgc2FtZSB2ZWxvY2l0eVxuXHRyZW1haW5pbmcgPSBAaG9va3MuaG9va3MuZmlsdGVyIChob29rKSAtPlxuXHRcdHByb3AgaXMgaG9vay5wcm9wXG5cdFx0XG5cdCMgSWYgbm90LCBkZWxldGUgdmVsb2NpdHkgKG90aGVyd2lzZSBpdCB3b24ndCBiZSByZXNldCBpZiB5b3UgbWFrZSBuZXcgaG9vayBmb3Igc2FtZSBwcm9wZXJ0eSlcblx0ZGVsZXRlIEBob29rcy52ZWxvY2l0aWVzW3Byb3BdIGlmIHJlbWFpbmluZy5sZW5ndGggaXMgMFxuXG5MYXllcjo6aG9va0xvb3AgPSAoZGVsdGEpIC0+XG5cblx0aWYgQGhvb2tzXG5cblx0XHQjIE11bHRpcGxlIGhvb2tzIGNhbiBhZmZlY3QgdGhlIHNhbWUgcHJvcGVydHkuIEFkZCBhY2NlbGVyYXRpb25zIHRvIHRlbXBvcmFyeSBvYmplY3Qgc28gdGhlIHByb3BlcnR5J3MgdmVsb2NpdHkgaXMgdGhlIHNhbWUgZm9yIGFsbCBjYWxjdWxhdGlvbnMgd2l0aGluIHRoZSBzYW1lIGFuaW1hdGlvbiBmcmFtZVxuXHRcdGFjY2VsZXJhdGlvbiA9IHt9XG5cdFx0XG5cdFx0IyBTYXZlIGRyYWcgZm9yIGVhY2ggcHJvcGVydHkgdG8gdGhpcyBvYmplY3QsIHNpbmNlIG9ubHkgbW9zdCByZWNlbnRseSBzcGVjaWZpZWQgdmFsdWUgaXMgdXNlZCBmb3IgZWFjaCBwcm9wZXJ0eVxuXHRcdGRyYWcgPSB7fVxuXHRcdFxuXHRcdCMgQWRkIGFjY2VsZXJhdGlvbnNcblx0XHRmb3IgaG9vayBpbiBAaG9va3MuaG9va3Ncblx0XHRcblx0XHRcdGlmIGhvb2sucHJvcCBpcyAncG9zJ1xuXG5cdFx0XHRcdGFjY2VsZXJhdGlvbi5wb3MgPz0geyB4OiAwLCB5OiAwIH1cblxuXHRcdFx0XHR0YXJnZXQgPSB7IHg6IGhvb2sudG9baG9vay50b1hdLCB5OiBob29rLnRvW2hvb2sudG9ZXSB9XG5cblx0XHRcdFx0dGFyZ2V0ID0gaG9vay5tb2R1bGF0b3IodGFyZ2V0KSBpZiBob29rLm1vZHVsYXRvclxuXG5cdFx0XHRcdHZlY3RvciA9XG5cdFx0XHRcdFx0eDogdGFyZ2V0LnggLSBAW2hvb2sudGhpc1hdXG5cdFx0XHRcdFx0eTogdGFyZ2V0LnkgLSBAW2hvb2sudGhpc1ldXG5cdFx0XHRcdFxuXHRcdFx0XHR2TGVuZ3RoID0gTWF0aC5zcXJ0KCh2ZWN0b3IueCAqIHZlY3Rvci54KSArICh2ZWN0b3IueSAqIHZlY3Rvci55KSlcblxuXHRcdFx0XHRpZiBob29rLnR5cGUgaXMgJ3NwcmluZydcblxuXHRcdFx0XHRcdGRhbXBlciA9XG5cdFx0XHRcdFx0XHR4OiAtaG9vay5mcmljdGlvbiAqIEBob29rcy52ZWxvY2l0aWVzLnBvcy54XG5cdFx0XHRcdFx0XHR5OiAtaG9vay5mcmljdGlvbiAqIEBob29rcy52ZWxvY2l0aWVzLnBvcy55XG5cblx0XHRcdFx0XHR2ZWN0b3IueCAqPSBob29rLnN0cmVuZ3RoXG5cdFx0XHRcdFx0dmVjdG9yLnkgKj0gaG9vay5zdHJlbmd0aFxuXHRcdFx0XHRcdFxuXHRcdFx0XHRcdGFjY2VsZXJhdGlvbi5wb3MueCArPSAodmVjdG9yLnggKyBkYW1wZXIueCkgKiBkZWx0YVxuXHRcdFx0XHRcdGFjY2VsZXJhdGlvbi5wb3MueSArPSAodmVjdG9yLnkgKyBkYW1wZXIueSkgKiBkZWx0YVxuXHRcdFx0XHRcblx0XHRcdFx0ZWxzZSBpZiBob29rLnR5cGUgaXMgJ2dyYXZpdHknXG5cdFx0XHRcdFxuXHRcdFx0XHRcdGRyYWcucG9zID0gaG9vay5mcmljdGlvblxuXHRcdFx0XHRcdFxuXHRcdFx0XHRcdGdyYXZpdHkgPSBAaG9va3MuZGVmcy5nZXRHcmF2aXR5KGhvb2suc3RyZW5ndGgsIHZMZW5ndGgsIEBob29rcy5kZWZzLnpvb20pXG5cblx0XHRcdFx0XHR2ZWN0b3IueCAqPSBncmF2aXR5IC8gdkxlbmd0aFxuXHRcdFx0XHRcdHZlY3Rvci55ICo9IGdyYXZpdHkgLyB2TGVuZ3RoXG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0YWNjZWxlcmF0aW9uLnBvcy54ICs9IHZlY3Rvci54ICogZGVsdGFcblx0XHRcdFx0XHRhY2NlbGVyYXRpb24ucG9zLnkgKz0gdmVjdG9yLnkgKiBkZWx0YVxuXHRcdFx0XHRcdFx0XHRcdFx0XG5cdFx0XHRlbHNlXG5cdFx0XHRcdFxuXHRcdFx0XHRhY2NlbGVyYXRpb25baG9vay5wcm9wXSA/PSAwXG5cblx0XHRcdFx0dGFyZ2V0ID0gaG9vay50b1tob29rLnRhcmdldFByb3BlcnR5XVxuXG5cdFx0XHRcdHRhcmdldCA9IGhvb2subW9kdWxhdG9yKHRhcmdldCkgaWYgaG9vay5tb2R1bGF0b3JcblxuXHRcdFx0XHR2ZWN0b3IgPSB0YXJnZXQgLSBAW2hvb2sucHJvcF1cblx0XHRcdFx0XG5cdFx0XHRcdGlmIGhvb2sudHlwZSBpcyAnc3ByaW5nJ1xuXG5cdFx0XHRcdFx0Zm9yY2UgPSB2ZWN0b3IgKiBob29rLnN0cmVuZ3RoXG5cdFx0XHRcdFx0ZGFtcGVyID0gLWhvb2suZnJpY3Rpb24gKiBAaG9va3MudmVsb2NpdGllc1tob29rLnByb3BdXG5cblx0XHRcdFx0XHRhY2NlbGVyYXRpb25baG9vay5wcm9wXSArPSAoZm9yY2UgKyBkYW1wZXIpICogZGVsdGFcblxuXHRcdFx0XHRcblx0XHRcdFx0ZWxzZSBpZiBob29rLnR5cGUgaXMgJ2dyYXZpdHknXG5cdFxuXHRcdFx0XHRcdGRyYWdbaG9vay5wcm9wXSA9IGhvb2suZnJpY3Rpb25cblx0XHRcdFx0XHRcblx0XHRcdFx0XHRmb3JjZSA9IEBob29rcy5kZWZzLmdldEdyYXZpdHkoaG9vay5zdHJlbmd0aCwgdmVjdG9yLCBAaG9va3MuZGVmcy56b29tKVxuXHRcdFx0XHRcdFxuXHRcdFx0XHRcdGFjY2VsZXJhdGlvbltob29rLnByb3BdICs9IGZvcmNlICogZGVsdGFcblx0XHRcblx0XHRcblx0XHQjIEFkZCB2ZWxvY2l0aWVzIHRvIHByb3BlcnRpZXMuIERvaW5nIHRoaXMgYXQgdGhlIGVuZCBpbiBjYXNlIHRoZXJlIGFyZSBtdWx0aXBsZSBob29rcyBhZmZlY3RpbmcgdGhlIHNhbWUgdmVsb2NpdHlcblx0XHRmb3IgcHJvcCwgdmVsb2NpdHkgb2YgQGhvb2tzLnZlbG9jaXRpZXNcblx0XHRcblx0XHRcdGlmIHByb3AgaXMgJ3BvcydcblxuXHRcdFx0XHQjIEFkZCBkcmFnLCBpZiBpdCBleGlzdHNcblx0XHRcdFx0aWYgZHJhZy5wb3Ncblx0XHRcdFx0XHR2ZWxvY2l0eS54ICs9IEBob29rcy5kZWZzLmdldERyYWcodmVsb2NpdHkueCwgZHJhZy5wb3MsIEBob29rcy5kZWZzLnpvb20pXG5cdFx0XHRcdFx0dmVsb2NpdHkueSArPSBAaG9va3MuZGVmcy5nZXREcmFnKHZlbG9jaXR5LnksIGRyYWcucG9zLCBAaG9va3MuZGVmcy56b29tKVxuXHRcdFx0XHRcdFxuXHRcdFx0XHQjIEFkZCBhY2NlbGVyYXRpb24gdG8gdmVsb2NpdHlcblx0XHRcdFx0dmVsb2NpdHkueCArPSBhY2NlbGVyYXRpb24ucG9zLnhcblx0XHRcdFx0dmVsb2NpdHkueSArPSBhY2NlbGVyYXRpb24ucG9zLnlcblx0XHRcdFx0XG5cdFx0XHRcdCMgQWRkIHZlbG9jaXR5IHRvIHBvc2l0aW9uXG5cdFx0XHRcdEB4ICs9IHZlbG9jaXR5LnggKiBkZWx0YVxuXHRcdFx0XHRAeSArPSB2ZWxvY2l0eS55ICogZGVsdGFcblx0XHRcdFxuXHRcdFx0ZWxzZVxuXHRcdFx0XG5cdFx0XHRcdCMgQWRkIGRyYWcsIGlmIGl0IGV4aXN0c1xuXHRcdFx0XHRpZiBkcmFnW3Byb3BdXG5cdFx0XHRcdFx0QGhvb2tzLnZlbG9jaXRpZXNbcHJvcF0gKz0gQGhvb2tzLmRlZnMuZ2V0RHJhZyhAaG9va3MudmVsb2NpdGllc1twcm9wXSwgZHJhZ1twcm9wXSwgQGhvb2tzLmRlZnMuem9vbSlcblx0XHRcdFx0XG5cdFx0XHRcdCMgQWRkIGFjY2VsZXJhdGlvbiB0byB2ZWxvY2l0eVxuXHRcdFx0XHRAaG9va3MudmVsb2NpdGllc1twcm9wXSArPSBhY2NlbGVyYXRpb25bcHJvcF1cblx0XHRcdFx0XG5cdFx0XHRcdCMgQWRkIHZlbG9jaXR5IHRvIHByb3BlcnR5XG5cdFx0XHRcdEBbcHJvcF0gKz0gQGhvb2tzLnZlbG9jaXRpZXNbcHJvcF0gKiBkZWx0YVxuXG5cdFx0QG9uSG9va1VwZGF0ZT8oZGVsdGEpIl19
