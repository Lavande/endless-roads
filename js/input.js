// 键盘 + 触屏输入
export class InputSystem {
  constructor() {
    this.keys = {};
    this.touch = { left: false, right: false, accel: false, brake: false, nitro: false };
    this.virtualSteer = 0;
    this.autoCruise = false; // 手机默认自动巡航

    this._onKeyDown = (e) => {
      if (e.repeat) return;
      this.keys[e.code] = true;
      for (const fn of this.keyHandlers) fn(e.code, true);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    };
    this._onKeyUp = (e) => {
      this.keys[e.code] = false;
      for (const fn of this.keyHandlers) fn(e.code, false);
    };
    this.keyHandlers = [];
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
  }

  onKey(fn) { this.keyHandlers.push(fn); }

  bindTouch() {
    const bind = (id, prop) => {
      const el = document.getElementById(id);
      if (!el) return;
      const on = (e) => { e.preventDefault(); this.touch[prop] = true; el.classList.add('active'); };
      const off = (e) => { e.preventDefault(); this.touch[prop] = false; el.classList.remove('active'); };
      el.addEventListener('pointerdown', on);
      el.addEventListener('pointerup', off);
      el.addEventListener('pointercancel', off);
      el.addEventListener('pointerleave', off);
    };
    bind('tL', 'left');
    bind('tR', 'right');
    bind('tN', 'nitro');
    bind('tB', 'brake');
  }

  get steer() {
    let s = 0;
    if (this.keys.KeyA || this.keys.ArrowLeft || this.touch.left) s -= 1;
    if (this.keys.KeyD || this.keys.ArrowRight || this.touch.right) s += 1;
    return s;
  }
  get accel() { return !!(this.keys.KeyW || this.keys.ArrowUp || this.touch.accel); }
  get brake() { return !!(this.keys.KeyS || this.keys.ArrowDown || this.touch.brake); }
  get nitro() { return !!(this.keys.ShiftLeft || this.keys.ShiftRight || this.keys.Space || this.touch.nitro); }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
  }
}
