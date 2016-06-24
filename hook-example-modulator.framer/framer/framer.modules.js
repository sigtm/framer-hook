require=(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({"Hook":[function(require,module,exports){

/*
--------------------------------------------------------------------------------
Hook module for Framer
--------------------------------------------------------------------------------

The Hook module simply expands the Layer prototype, and lets you make any
numeric Layer property follow a property on another object via a spring or
a gravity attraction.


--------------------------------------------------------------------------------
Simple example
--------------------------------------------------------------------------------

target = new Layer
hooked = new Layer

hooked.hook
	property: "scale"
	to: target
	type: "spring(150, 15)"

The "hooked" layer's scale will now continuously follow the target layer's scale
with a spring animation.

To attach both the x and y position, use "pos", "midPos" or "maxPos" as the
property/target property.


--------------------------------------------------------------------------------
layer.hook(options)
--------------------------------------------------------------------------------

Options are passed as a single object, like you would for a new Layer.
The options object takes the following properties:


property [String]
-----------------
The property you'd like to hook onto another object's property


to [Object]
-----------
The object to attach it to


type [String]
-------------
Either "spring(strength, friction)" or "gravity(strength, drag)". Only the last
specified drag value is used for each property, since it is only applied to
each property once (and only if it has a gravity hook applied to it.)


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
	targetproperty: "y"
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
  var base, f, name;
  if (!(config.property && config.to && config.type)) {
    throw new Error('layer.hook() needs a property, a target object and a hook type to work');
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
  return Framer.Loop.on('render', this.hookLoop, this);
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
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVXNlcnMvc2lndXJkL1JlcG9zL2ZyYW1lci1ob29rL2hvb2stZXhhbXBsZS1tb2R1bGF0b3IuZnJhbWVyL21vZHVsZXMvSG9vay5jb2ZmZWUiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7O0FDQUE7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBZ0hBLElBQUEsQ0FBTyxNQUFNLENBQUMsU0FBUyxDQUFDLFFBQXhCO0VBQ0MsTUFBTSxDQUFBLFNBQUUsQ0FBQSxRQUFSLEdBQW1CLFNBQUMsTUFBRCxFQUFTLEtBQVQ7SUFDbEI7SUFDQSxJQUFhLE9BQU8sS0FBUCxLQUFnQixRQUE3QjtNQUFBLEtBQUEsR0FBUSxFQUFSOztJQUVBLElBQUcsS0FBQSxHQUFRLE1BQU0sQ0FBQyxNQUFmLEdBQXdCLElBQUksQ0FBQyxNQUFoQztBQUNDLGFBQU8sTUFEUjtLQUFBLE1BQUE7QUFHQyxhQUFPLElBQUMsQ0FBQSxPQUFELENBQVMsTUFBVCxFQUFpQixLQUFqQixDQUFBLEtBQTZCLENBQUMsRUFIdEM7O0VBSmtCLEVBRHBCOzs7QUFZQSxLQUFLLENBQUEsU0FBRSxDQUFBLElBQVAsR0FBYyxTQUFDLE1BQUQ7QUFFYixNQUFBO0VBQUEsSUFBQSxDQUFBLENBQWdHLE1BQU0sQ0FBQyxRQUFQLElBQW9CLE1BQU0sQ0FBQyxFQUEzQixJQUFrQyxNQUFNLENBQUMsSUFBekksQ0FBQTtBQUFBLFVBQVUsSUFBQSxLQUFBLENBQU0sd0VBQU4sRUFBVjs7O0lBR0EsSUFBQyxDQUFBLFFBQ0E7TUFBQSxLQUFBLEVBQU8sRUFBUDtNQUNBLFVBQUEsRUFBWSxFQURaO01BRUEsSUFBQSxFQUNDO1FBQUEsSUFBQSxF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WUFBWSxDQUFDLEdBQUcsQ0FBQztRQUcvQixJQUFDLENBQUEsQ0FBRCxJQUFNLFFBQVEsQ0FBQyxDQUFULEdBQWE7UUFDbkIsSUFBQyxDQUFBLENBQUQsSUFBTSxRQUFRLENBQUMsQ0FBVCxHQUFhLE1BYnBCO09BQUEsTUFBQTtRQWtCQyxJQUFHLElBQUssQ0FBQSxJQUFBLENBQVI7VUFDQyxJQUFDLENBQUEsS0FBSyxDQUFDLFVBQVcsQ0FBQSxJQUFBLENBQWxCLElBQTJCLElBQUMsQ0FBQSxLQUFLLENBQUMsSUFBSSxDQUFDLE9BQVosQ0FBb0IsSUFBQyxDQUFBLEtBQUssQ0FBQyxVQUFXLENBQUEsSUFBQSxDQUF0QyxFQUE2QyxJQUFLLENBQUEsSUFBQSxDQUFsRCxFQUF5RCxJQUFDLENBQUEsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFyRSxFQUQ1Qjs7UUFJQSxJQUFDLENBQUEsS0FBSyxDQUFDLFVBQVcsQ0FBQSxJQUFBLENBQWxCLElBQTJCLFlBQWEsQ0FBQSxJQUFBO1FBR3hDLElBQUUsQ0FBQSxJQUFBLENBQUYsSUFBVyxJQUFDLENBQUEsS0FBSyxDQUFDLFVBQVcsQ0FBQSxJQUFBLENBQWxCLEdBQTBCLE1BekJ0Qzs7QUFGRDtxREE2QkEsSUFBQyxDQUFBLGFBQWMsZ0JBMUdoQjs7QUFGaUIiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiIyMjXG4tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuSG9vayBtb2R1bGUgZm9yIEZyYW1lclxuLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuVGhlIEhvb2sgbW9kdWxlIHNpbXBseSBleHBhbmRzIHRoZSBMYXllciBwcm90b3R5cGUsIGFuZCBsZXRzIHlvdSBtYWtlIGFueVxubnVtZXJpYyBMYXllciBwcm9wZXJ0eSBmb2xsb3cgYSBwcm9wZXJ0eSBvbiBhbm90aGVyIG9iamVjdCB2aWEgYSBzcHJpbmcgb3JcbmEgZ3Jhdml0eSBhdHRyYWN0aW9uLlxuXG5cbi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5TaW1wbGUgZXhhbXBsZVxuLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxudGFyZ2V0ID0gbmV3IExheWVyXG5ob29rZWQgPSBuZXcgTGF5ZXJcblxuaG9va2VkLmhvb2tcblx0cHJvcGVydHk6IFwic2NhbGVcIlxuXHR0bzogdGFyZ2V0XG5cdHR5cGU6IFwic3ByaW5nKDE1MCwgMTUpXCJcblxuVGhlIFwiaG9va2VkXCIgbGF5ZXIncyBzY2FsZSB3aWxsIG5vdyBjb250aW51b3VzbHkgZm9sbG93IHRoZSB0YXJnZXQgbGF5ZXIncyBzY2FsZVxud2l0aCBhIHNwcmluZyBhbmltYXRpb24uXG5cblRvIGF0dGFjaCBib3RoIHRoZSB4IGFuZCB5IHBvc2l0aW9uLCB1c2UgXCJwb3NcIiwgXCJtaWRQb3NcIiBvciBcIm1heFBvc1wiIGFzIHRoZVxucHJvcGVydHkvdGFyZ2V0IHByb3BlcnR5LlxuXG5cbi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5sYXllci5ob29rKG9wdGlvbnMpXG4tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5PcHRpb25zIGFyZSBwYXNzZWQgYXMgYSBzaW5nbGUgb2JqZWN0LCBsaWtlIHlvdSB3b3VsZCBmb3IgYSBuZXcgTGF5ZXIuXG5UaGUgb3B0aW9ucyBvYmplY3QgdGFrZXMgdGhlIGZvbGxvd2luZyBwcm9wZXJ0aWVzOlxuXG5cbnByb3BlcnR5IFtTdHJpbmddXG4tLS0tLS0tLS0tLS0tLS0tLVxuVGhlIHByb3BlcnR5IHlvdSdkIGxpa2UgdG8gaG9vayBvbnRvIGFub3RoZXIgb2JqZWN0J3MgcHJvcGVydHlcblxuXG50byBbT2JqZWN0XVxuLS0tLS0tLS0tLS1cblRoZSBvYmplY3QgdG8gYXR0YWNoIGl0IHRvXG5cblxudHlwZSBbU3RyaW5nXVxuLS0tLS0tLS0tLS0tLVxuRWl0aGVyIFwic3ByaW5nKHN0cmVuZ3RoLCBmcmljdGlvbilcIiBvciBcImdyYXZpdHkoc3RyZW5ndGgsIGRyYWcpXCIuIE9ubHkgdGhlIGxhc3RcbnNwZWNpZmllZCBkcmFnIHZhbHVlIGlzIHVzZWQgZm9yIGVhY2ggcHJvcGVydHksIHNpbmNlIGl0IGlzIG9ubHkgYXBwbGllZCB0b1xuZWFjaCBwcm9wZXJ0eSBvbmNlIChhbmQgb25seSBpZiBpdCBoYXMgYSBncmF2aXR5IGhvb2sgYXBwbGllZCB0byBpdC4pXG5cblxudGFyZ2V0UHJvcGVydHkgW1N0cmluZ10gKE9wdGlvbmFsKVxuLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuU3BlY2lmeSB0aGUgdGFyZ2V0IG9iamVjdCdzIHByb3BlcnR5IHRvIGZvbGxvdywgaWYgeW91IGRvbid0IHdhbnQgdG8gZm9sbG93XG50aGUgc2FtZSBwcm9wZXJ0eSB0aGF0IHRoZSBob29rIGlzIGFwcGxpZWQgdG8uXG5cblxubW9kdWxhdG9yIFtGdW5jdGlvbl0gKE9wdGlvbmFsKVxuLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuVGhlIG1vZHVsYXRvciBmdW5jdGlvbiByZWNlaXZlcyB0aGUgdGFyZ2V0IHByb3BlcnR5J3MgdmFsdWUsIGFuZCBsZXRzIHlvdVxubW9kaWZ5IGl0IGJlZm9yZSBpdCBpcyBmZWQgaW50byB0aGUgcGh5c2ljcyBjYWxjdWxhdGlvbnMuIFVzZWZ1bCBmb3IgYW55dGhpbmdcbmZyb20gc3RhbmRhcmQgVXRpbHMubW9kdWxhdGUoKSB0eXBlIHN0dWZmIHRvIHNuYXBwaW5nIGFuZCBjb25kaXRpb25hbCB2YWx1ZXMuXG5cblxuem9vbSBbTnVtYmVyXSAoT3B0aW9uYWwpXG4tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblRoaXMgZmFjdG9yIGRlZmluZXMgdGhlIGRpc3RhbmNlIHRoYXQgMXB4IHJlcHJlc2VudHMgaW4gcmVnYXJkcyB0byBncmF2aXR5IGFuZFxuZHJhZyBjYWxjdWxhdGlvbnMuIE9ubHkgb25lIHZhbHVlIGlzIHN0b3JlZCBwZXIgbGF5ZXIsIHNvIHNwZWNpZnlpbmcgaXRcbm92ZXJ3cml0ZXMgaXRzIGV4aXN0aW5nIHZhbHVlLiBEZWZhdWx0IGlzIDEwMC5cblxuXG5cbi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5sYXllci51bkhvb2socHJvcGVydHksIG9iamVjdClcbi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cblRoaXMgcmVtb3ZlcyBhbGwgaG9va3MgZm9yIGEgZ2l2ZW4gcHJvcGVydHkgYW5kIHRhcmdldCBvYmplY3QuIEV4YW1wbGU6XG5cbiMgSG9vayBpdFxubGF5ZXIuaG9va1xuXHRwcm9wZXJ0eTogXCJ4XCJcblx0dG86IFwib3RoZXJsYXllclwiXG5cdHRhcmdldHByb3BlcnR5OiBcInlcIlxuXHR0eXBlOiBcInNwcmluZygyMDAsMjApXCJcblxuIyBVbmhvb2sgaXRcbmxheWVyLnVuSG9vayBcInhcIiwgb3RoZXJsYXllclxuXG5cbi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5sYXllci5vbkhvb2tVcGRhdGUoZGVsdGEpXG4tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5BZnRlciBhIGxheWVyIGlzIGRvbmUgYXBwbHlpbmcgYWNjZWxlcmF0aW9ucyB0byBpdHMgaG9va2VkIHByb3BlcnRpZXMsIGl0IGNhbGxzXG5vbkhvb2tVcGRhdGUoKSBhdCB0aGUgZW5kIG9mIGVhY2ggZnJhbWUsIGlmIGl0IGlzIGRlZmluZWQuIFRoaXMgaXMgYW4gZWFzeSB3YXlcbnRvIGFuaW1hdGUgb3IgdHJpZ2dlciBvdGhlciBzdHVmZiwgcGVyaGFwcyBiYXNlZCBvbiB5b3VyIGxheWVyJ3MgdXBkYXRlZFxucHJvcGVydGllcyBvciB2ZWxvY2l0aWVzLlxuXG5UaGUgZGVsdGEgdmFsdWUgZnJvbSB0aGUgRnJhbWVyIGxvb3AgaXMgcGFzc2VkIG9uIHRvIG9uSG9va1VwZGF0ZSgpIGFzIHdlbGwsXG53aGljaCBpcyB0aGUgdGltZSBpbiBzZWNvbmRzIHNpbmNlIHRoZSBsYXN0IGFuaW1hdGlvbiBmcmFtZS5cblxuTm90ZSB0aGF0IGlmIHlvdSB1bmhvb2sgYWxsIHlvdXIgaG9va3MsIG9uSG9va1VwZGF0ZSgpIHdpbGwgb2YgY291cnNlIG5vIGxvbmdlclxuYmUgY2FsbGVkIGZvciB0aGF0IGxheWVyLlxuXG4jIyNcblxuXG4jIFNpbmNlIG9sZGVyIHZlcnNpb25zIG9mIFNhZmFyaSBzZWVtIHRvIGJlIG1pc3NpbmcgU3RyaW5nLnByb3RvdHlwZS5pbmNsdWRlcygpXG5cbnVubGVzcyBTdHJpbmcucHJvdG90eXBlLmluY2x1ZGVzXG5cdFN0cmluZzo6aW5jbHVkZXMgPSAoc2VhcmNoLCBzdGFydCkgLT5cblx0XHQndXNlIHN0cmljdCdcblx0XHRzdGFydCA9IDAgaWYgdHlwZW9mIHN0YXJ0IGlzICdudW1iZXInXG5cblx0XHRpZiBzdGFydCArIHNlYXJjaC5sZW5ndGggPiB0aGlzLmxlbmd0aFxuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdGVsc2Vcblx0XHRcdHJldHVybiBAaW5kZXhPZihzZWFyY2gsIHN0YXJ0KSBpc250IC0xXG5cbiMgRXhwYW5kIGxheWVyXG5cbkxheWVyOjpob29rID0gKGNvbmZpZykgLT5cblxuXHR0aHJvdyBuZXcgRXJyb3IgJ2xheWVyLmhvb2soKSBuZWVkcyBhIHByb3BlcnR5LCBhIHRhcmdldCBvYmplY3QgYW5kIGEgaG9vayB0eXBlIHRvIHdvcmsnIHVubGVzcyBjb25maWcucHJvcGVydHkgYW5kIGNvbmZpZy50byBhbmQgY29uZmlnLnR5cGVcblxuXHQjIFNpbmdsZSBhcnJheSBmb3IgYWxsIGhvb2tzLCBhcyBvcHBvc2VkIHRvIG5lc3RlZCBhcnJheXMgcGVyIHByb3BlcnR5LCBiZWNhdXNlIHBlcmZvcm1hbmNlXG5cdEBob29rcyA/PVxuXHRcdGhvb2tzOiBbXVxuXHRcdHZlbG9jaXRpZXM6IHt9XG5cdFx0ZGVmczpcblx0XHRcdHpvb206IDEwMFxuXHRcdFx0Z2V0RHJhZzogKHZlbG9jaXR5LCBkcmFnLCB6b29tKSA9PlxuXHRcdFx0XHR2ZWxvY2l0eSAvPSB6b29tXG5cdFx0XHRcdCMgRGl2aWRpbmcgYnkgMTAgaXMgdW5zY2llbnRpZmljLCBidXQgaXQgbWVhbnMgYSB2YWx1ZSBvZiAyIGVxdWFscyByb3VnaGx5IGEgMTAwZyBiYWxsIHdpdGggMTVjbSByYWRpdXMgaW4gYWlyXG5cdFx0XHRcdGRyYWcgPSAtKGRyYWcgLyAxMCkgKiB2ZWxvY2l0eSAqIHZlbG9jaXR5ICogdmVsb2NpdHkgLyBNYXRoLmFicyh2ZWxvY2l0eSlcblx0XHRcdFx0aWYgXy5pc05hTihkcmFnKSB0aGVuIHJldHVybiAwIGVsc2UgcmV0dXJuIGRyYWdcblx0XHRcdGdldEdyYXZpdHk6IChzdHJlbmd0aCwgZGlzdGFuY2UsIHpvb20pID0+XG5cdFx0XHRcdGRpc3QgPSBNYXRoLm1heCgxLCBkaXN0YW5jZSAvIHpvb20pXG5cdFx0XHRcdHJldHVybiBzdHJlbmd0aCAqIHpvb20gLyAoZGlzdCAqIGRpc3QpXG5cblx0IyBVcGRhdGUgdGhlIHpvb20gdmFsdWUgaWYgZ2l2ZW5cblx0QGhvb2tzLnpvb20gPSBjb25maWcuem9vbSBpZiBjb25maWcuem9vbVxuXG5cdCMgUGFyc2UgcGh5c2ljcyBjb25maWcgc3RyaW5nXG5cdGYgPSBVdGlscy5wYXJzZUZ1bmN0aW9uIGNvbmZpZy50eXBlXG5cdGNvbmZpZy50eXBlID0gZi5uYW1lXG5cdGNvbmZpZy5zdHJlbmd0aCA9IGYuYXJnc1swXVxuXHRjb25maWcuZnJpY3Rpb24gPSBmLmFyZ3NbMV0gb3IgMFxuXG5cdCMgRm9sbG93IHNhbWUgcHJvcGVydHkgb24gdGFyZ2V0IG9iamVjdCBieSBkZWZhdWx0XG5cdGNvbmZpZy50YXJnZXRQcm9wZXJ0eSA/PSBjb25maWcucHJvcGVydHlcblxuXHQjIEFsbCBwb3NpdGlvbiBhY2NlbGVyYXRpb25zIGFyZSBhZGRlZCB0byBhIHNpbmdsZSAncG9zJyB2ZWxvY2l0eS4gU3RvcmUgYWN0dWFsIHByb3BlcnRpZXMgc28gd2UgZG9uJ3QgaGF2ZSB0byBkbyBpdCBhZ2FpbiBldmVyeSBmcmFtZVxuXG5cdGlmIGNvbmZpZy5wcm9wZXJ0eS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzICdwb3MnXG5cdFx0Y29uZmlnLnByb3AgPSAncG9zJ1xuXHRcdFxuXHRcdGlmIGNvbmZpZy5wcm9wZXJ0eS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzICdtaWQnXG5cdFx0XHRjb25maWcudGhpc1ggPSAnbWlkWCdcblx0XHRcdGNvbmZpZy50aGlzWSA9ICdtaWRZJ1xuXHRcdFxuXHRcdGVsc2UgaWYgY29uZmlnLnByb3BlcnR5LnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMgJ21heCdcblx0XHRcdGNvbmZpZy50aGlzWCA9ICdtYXhYJ1xuXHRcdFx0Y29uZmlnLnRoaXNZID0gJ21heFknXG5cdFx0XG5cdFx0ZWxzZVxuXHRcdFx0Y29uZmlnLnRoaXNYID0gJ3gnXG5cdFx0XHRjb25maWcudGhpc1kgPSAneSdcblx0XHRcblx0XHRpZiBjb25maWcudGFyZ2V0UHJvcGVydHkudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyAnbWlkJ1xuXHRcdFx0Y29uZmlnLnRvWCA9ICdtaWRYJ1xuXHRcdFx0Y29uZmlnLnRvWSA9ICdtaWRZJ1xuXHRcdFxuXHRcdGVsc2UgaWYgY29uZmlnLnRhcmdldFByb3BlcnR5LnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMgJ21heCdcblx0XHRcdGNvbmZpZy50b1ggPSAnbWF4WCdcblx0XHRcdGNvbmZpZy50b1kgPSAnbWF4WSdcdFx0XG5cdFx0ZWxzZVxuXHRcdFx0Y29uZmlnLnRvWCA9ICd4J1xuXHRcdFx0Y29uZmlnLnRvWSA9ICd5J1xuXHRcdFxuXHRlbHNlXG5cdFx0Y29uZmlnLnByb3AgPSBjb25maWcucHJvcGVydHlcblxuXHQjIFNhdmUgaG9vayB0byBAaG9va3MgYXJyYXlcdFxuXHRAaG9va3MuaG9va3MucHVzaChjb25maWcpXG5cblx0IyBDcmVhdGUgdmVsb2NpdHkgcHJvcGVydHkgaWYgbmVjZXNzYXJ5XG5cdEBob29rcy52ZWxvY2l0aWVzW2NvbmZpZy5wcm9wXSA/PSBpZiBjb25maWcucHJvcCBpcyAncG9zJyB0aGVuIHsgeDogMCwgeTogMCB9IGVsc2UgMFxuXG5cdCMgVXNlIEZyYW1lcidzIGFuaW1hdGlvbiBsb29wLCBzbGlnaHRseSBtb3JlIHJvYnVzdCB0aGFuIHJlcXVlc3RBbmltYXRpb25GcmFtZSBkaXJlY3RseVxuXHRGcmFtZXIuTG9vcC5vbiAncmVuZGVyJywgQGhvb2tMb29wLCB0aGlzXG5cblxuXG5MYXllcjo6dW5Ib29rID0gKHByb3BlcnR5LCBvYmplY3QpIC0+XG5cdFxuXHRyZXR1cm4gdW5sZXNzIEBob29rc1xuXG5cdHByb3AgPSBpZiBwcm9wZXJ0eS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzICdwb3MnIHRoZW4gJ3BvcycgZWxzZSBwcm9wZXJ0eVxuXG5cdCMgUmVtb3ZlIGFsbCBtYXRjaGVzXG5cdEBob29rcy5ob29rcyA9IEBob29rcy5ob29rcy5maWx0ZXIgKGhvb2spIC0+XG5cdFx0aG9vay50byBpc250IG9iamVjdCBvciBob29rLnByb3BlcnR5IGlzbnQgcHJvcGVydHlcblxuXHQjIElmIHRoZXJlIGFyZSBubyBob29rcyBsZWZ0LCBzaHV0IGl0IGRvd25cblx0aWYgQGhvb2tzLmhvb2tzLmxlbmd0aCBpcyAwXG5cdFx0ZGVsZXRlIEBob29rc1xuXHRcdEZyYW1lci5Mb29wLnJlbW92ZUxpc3RlbmVyICdyZW5kZXInLCBAaG9va0xvb3Bcblx0XHRyZXR1cm5cblxuXHQjIFN0aWxsIGhlcmU/IENoZWNrIGlmIHRoZXJlIGFyZSBhbnkgcmVtYWluaW5nIGhvb2tzIGFmZmVjdGluZyBzYW1lIHZlbG9jaXR5XG5cdHJlbWFpbmluZyA9IEBob29rcy5ob29rcy5maWx0ZXIgKGhvb2spIC0+XG5cdFx0cHJvcCBpcyBob29rLnByb3Bcblx0XHRcblx0IyBJZiBub3QsIGRlbGV0ZSB2ZWxvY2l0eSAob3RoZXJ3aXNlIGl0IHdvbid0IGJlIHJlc2V0IGlmIHlvdSBtYWtlIG5ldyBob29rIGZvciBzYW1lIHByb3BlcnR5KVxuXHRkZWxldGUgQGhvb2tzLnZlbG9jaXRpZXNbcHJvcF0gaWYgcmVtYWluaW5nLmxlbmd0aCBpcyAwXG5cbkxheWVyOjpob29rTG9vcCA9IChkZWx0YSkgLT5cblxuXHRpZiBAaG9va3NcblxuXHRcdCMgTXVsdGlwbGUgaG9va3MgY2FuIGFmZmVjdCB0aGUgc2FtZSBwcm9wZXJ0eS4gQWRkIGFjY2VsZXJhdGlvbnMgdG8gdGVtcG9yYXJ5IG9iamVjdCBzbyB0aGUgcHJvcGVydHkncyB2ZWxvY2l0eSBpcyB0aGUgc2FtZSBmb3IgYWxsIGNhbGN1bGF0aW9ucyB3aXRoaW4gdGhlIHNhbWUgYW5pbWF0aW9uIGZyYW1lXG5cdFx0YWNjZWxlcmF0aW9uID0ge31cblx0XHRcblx0XHQjIFNhdmUgZHJhZyBmb3IgZWFjaCBwcm9wZXJ0eSB0byB0aGlzIG9iamVjdCwgc2luY2Ugb25seSBtb3N0IHJlY2VudGx5IHNwZWNpZmllZCB2YWx1ZSBpcyB1c2VkIGZvciBlYWNoIHByb3BlcnR5XG5cdFx0ZHJhZyA9IHt9XG5cdFx0XG5cdFx0IyBBZGQgYWNjZWxlcmF0aW9uc1xuXHRcdGZvciBob29rIGluIEBob29rcy5ob29rc1xuXHRcdFxuXHRcdFx0aWYgaG9vay5wcm9wIGlzICdwb3MnXG5cblx0XHRcdFx0YWNjZWxlcmF0aW9uLnBvcyA/PSB7IHg6IDAsIHk6IDAgfVxuXG5cdFx0XHRcdHRhcmdldCA9IHsgeDogaG9vay50b1tob29rLnRvWF0sIHk6IGhvb2sudG9baG9vay50b1ldIH1cblxuXHRcdFx0XHR0YXJnZXQgPSBob29rLm1vZHVsYXRvcih0YXJnZXQpIGlmIGhvb2subW9kdWxhdG9yXG5cblx0XHRcdFx0dmVjdG9yID1cblx0XHRcdFx0XHR4OiB0YXJnZXQueCAtIEBbaG9vay50aGlzWF1cblx0XHRcdFx0XHR5OiB0YXJnZXQueSAtIEBbaG9vay50aGlzWV1cblx0XHRcdFx0XG5cdFx0XHRcdHZMZW5ndGggPSBNYXRoLnNxcnQoKHZlY3Rvci54ICogdmVjdG9yLngpICsgKHZlY3Rvci55ICogdmVjdG9yLnkpKVxuXG5cdFx0XHRcdGlmIGhvb2sudHlwZSBpcyAnc3ByaW5nJ1xuXG5cdFx0XHRcdFx0ZGFtcGVyID1cblx0XHRcdFx0XHRcdHg6IC1ob29rLmZyaWN0aW9uICogQGhvb2tzLnZlbG9jaXRpZXMucG9zLnhcblx0XHRcdFx0XHRcdHk6IC1ob29rLmZyaWN0aW9uICogQGhvb2tzLnZlbG9jaXRpZXMucG9zLnlcblxuXHRcdFx0XHRcdHZlY3Rvci54ICo9IGhvb2suc3RyZW5ndGhcblx0XHRcdFx0XHR2ZWN0b3IueSAqPSBob29rLnN0cmVuZ3RoXG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0YWNjZWxlcmF0aW9uLnBvcy54ICs9ICh2ZWN0b3IueCArIGRhbXBlci54KSAqIGRlbHRhXG5cdFx0XHRcdFx0YWNjZWxlcmF0aW9uLnBvcy55ICs9ICh2ZWN0b3IueSArIGRhbXBlci55KSAqIGRlbHRhXG5cdFx0XHRcdFxuXHRcdFx0XHRlbHNlIGlmIGhvb2sudHlwZSBpcyAnZ3Jhdml0eSdcblx0XHRcdFx0XG5cdFx0XHRcdFx0ZHJhZy5wb3MgPSBob29rLmZyaWN0aW9uXG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0Z3Jhdml0eSA9IEBob29rcy5kZWZzLmdldEdyYXZpdHkoaG9vay5zdHJlbmd0aCwgdkxlbmd0aCwgQGhvb2tzLmRlZnMuem9vbSlcblxuXHRcdFx0XHRcdHZlY3Rvci54ICo9IGdyYXZpdHkgLyB2TGVuZ3RoXG5cdFx0XHRcdFx0dmVjdG9yLnkgKj0gZ3Jhdml0eSAvIHZMZW5ndGhcblx0XHRcdFx0XHRcblx0XHRcdFx0XHRhY2NlbGVyYXRpb24ucG9zLnggKz0gdmVjdG9yLnggKiBkZWx0YVxuXHRcdFx0XHRcdGFjY2VsZXJhdGlvbi5wb3MueSArPSB2ZWN0b3IueSAqIGRlbHRhXG5cdFx0XHRcdFx0XHRcdFx0XHRcblx0XHRcdGVsc2Vcblx0XHRcdFx0XG5cdFx0XHRcdGFjY2VsZXJhdGlvbltob29rLnByb3BdID89IDBcblxuXHRcdFx0XHR0YXJnZXQgPSBob29rLnRvW2hvb2sudGFyZ2V0UHJvcGVydHldXG5cblx0XHRcdFx0dGFyZ2V0ID0gaG9vay5tb2R1bGF0b3IodGFyZ2V0KSBpZiBob29rLm1vZHVsYXRvclxuXG5cdFx0XHRcdHZlY3RvciA9IHRhcmdldCAtIEBbaG9vay5wcm9wXVxuXHRcdFx0XHRcblx0XHRcdFx0aWYgaG9vay50eXBlIGlzICdzcHJpbmcnXG5cblx0XHRcdFx0XHRmb3JjZSA9IHZlY3RvciAqIGhvb2suc3RyZW5ndGhcblx0XHRcdFx0XHRkYW1wZXIgPSAtaG9vay5mcmljdGlvbiAqIEBob29rcy52ZWxvY2l0aWVzW2hvb2sucHJvcF1cblxuXHRcdFx0XHRcdGFjY2VsZXJhdGlvbltob29rLnByb3BdICs9IChmb3JjZSArIGRhbXBlcikgKiBkZWx0YVxuXG5cdFx0XHRcdFxuXHRcdFx0XHRlbHNlIGlmIGhvb2sudHlwZSBpcyAnZ3Jhdml0eSdcblx0XG5cdFx0XHRcdFx0ZHJhZ1tob29rLnByb3BdID0gaG9vay5mcmljdGlvblxuXHRcdFx0XHRcdFxuXHRcdFx0XHRcdGZvcmNlID0gQGhvb2tzLmRlZnMuZ2V0R3Jhdml0eShob29rLnN0cmVuZ3RoLCB2ZWN0b3IsIEBob29rcy5kZWZzLnpvb20pXG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0YWNjZWxlcmF0aW9uW2hvb2sucHJvcF0gKz0gZm9yY2UgKiBkZWx0YVxuXHRcdFxuXHRcdFxuXHRcdCMgQWRkIHZlbG9jaXRpZXMgdG8gcHJvcGVydGllcy4gRG9pbmcgdGhpcyBhdCB0aGUgZW5kIGluIGNhc2UgdGhlcmUgYXJlIG11bHRpcGxlIGhvb2tzIGFmZmVjdGluZyB0aGUgc2FtZSB2ZWxvY2l0eVxuXHRcdGZvciBwcm9wLCB2ZWxvY2l0eSBvZiBAaG9va3MudmVsb2NpdGllc1xuXHRcdFxuXHRcdFx0aWYgcHJvcCBpcyAncG9zJ1xuXG5cdFx0XHRcdCMgQWRkIGRyYWcsIGlmIGl0IGV4aXN0c1xuXHRcdFx0XHRpZiBkcmFnLnBvc1xuXHRcdFx0XHRcdHZlbG9jaXR5LnggKz0gQGhvb2tzLmRlZnMuZ2V0RHJhZyh2ZWxvY2l0eS54LCBkcmFnLnBvcywgQGhvb2tzLmRlZnMuem9vbSlcblx0XHRcdFx0XHR2ZWxvY2l0eS55ICs9IEBob29rcy5kZWZzLmdldERyYWcodmVsb2NpdHkueSwgZHJhZy5wb3MsIEBob29rcy5kZWZzLnpvb20pXG5cdFx0XHRcdFx0XG5cdFx0XHRcdCMgQWRkIGFjY2VsZXJhdGlvbiB0byB2ZWxvY2l0eVxuXHRcdFx0XHR2ZWxvY2l0eS54ICs9IGFjY2VsZXJhdGlvbi5wb3MueFxuXHRcdFx0XHR2ZWxvY2l0eS55ICs9IGFjY2VsZXJhdGlvbi5wb3MueVxuXHRcdFx0XHRcblx0XHRcdFx0IyBBZGQgdmVsb2NpdHkgdG8gcG9zaXRpb25cblx0XHRcdFx0QHggKz0gdmVsb2NpdHkueCAqIGRlbHRhXG5cdFx0XHRcdEB5ICs9IHZlbG9jaXR5LnkgKiBkZWx0YVxuXHRcdFx0XG5cdFx0XHRlbHNlXG5cdFx0XHRcblx0XHRcdFx0IyBBZGQgZHJhZywgaWYgaXQgZXhpc3RzXG5cdFx0XHRcdGlmIGRyYWdbcHJvcF1cblx0XHRcdFx0XHRAaG9va3MudmVsb2NpdGllc1twcm9wXSArPSBAaG9va3MuZGVmcy5nZXREcmFnKEBob29rcy52ZWxvY2l0aWVzW3Byb3BdLCBkcmFnW3Byb3BdLCBAaG9va3MuZGVmcy56b29tKVxuXHRcdFx0XHRcblx0XHRcdFx0IyBBZGQgYWNjZWxlcmF0aW9uIHRvIHZlbG9jaXR5XG5cdFx0XHRcdEBob29rcy52ZWxvY2l0aWVzW3Byb3BdICs9IGFjY2VsZXJhdGlvbltwcm9wXVxuXHRcdFx0XHRcblx0XHRcdFx0IyBBZGQgdmVsb2NpdHkgdG8gcHJvcGVydHlcblx0XHRcdFx0QFtwcm9wXSArPSBAaG9va3MudmVsb2NpdGllc1twcm9wXSAqIGRlbHRhXG5cblx0XHRAb25Ib29rVXBkYXRlPyhkZWx0YSkiXX0=
