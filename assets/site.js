/* ============================================================
   NIKHIL AI LABS — shared interactions
   Used by: index.html, products/*.html
   ============================================================ */
(function () {
  // Mobile nav toggle
  var nav = document.getElementById('nav');
  var toggle = document.getElementById('navToggle');
  if (nav && toggle) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    nav.querySelectorAll('.nav__links a').forEach(function (a) {
      a.addEventListener('click', function () {
        nav.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // Seamless marquee: duplicate the track content once (home only)
  var track = document.getElementById('marquee');
  if (track) track.innerHTML += track.innerHTML;

  // Scroll reveal
  var els = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) {
    els.forEach(function (el) { el.classList.add('in'); });
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  els.forEach(function (el) { io.observe(el); });
})();

/* Pilot request form → platform API (app.nikhilailabs.com) */
(function () {
  var form = document.getElementById('pilotForm');
  if (!form) return;
  var btn = document.getElementById('pilotSubmit');
  var statusEl = document.getElementById('pilotStatus');
  var submitting = false;

  // Auto-target localhost during dev; production otherwise.
  var API = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
    ? 'http://localhost:3000/api/pilot-requests'
    : 'https://app.nikhilailabs.com/api/pilot-requests';

  function val(id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; }
  function setStatus(kind, msg) {
    statusEl.className = 'pilot-status' + (kind ? ' ' + kind : '');
    statusEl.textContent = msg || '';
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (submitting) return; // prevent duplicate rapid submissions

    var data = {
      name: val('pf-name'),
      email: val('pf-email'),
      company: val('pf-company'),
      role: document.getElementById('pf-role').value,
      product: document.getElementById('pf-product').value,
      message: val('pf-message')
    };

    if (!data.name || !data.email || !data.company) {
      setStatus('err', 'Please add your name, work email, and company.');
      return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email)) {
      setStatus('err', 'Please enter a valid email address.');
      return;
    }

    submitting = true;
    var label = btn.innerHTML;
    btn.disabled = true;
    btn.style.opacity = '0.65';
    btn.style.cursor = 'not-allowed';
    btn.textContent = 'Submitting…';
    setStatus('', '');

    fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      form.classList.add('is-success');
      var ok = document.getElementById('pilotSuccess');
      if (ok) ok.setAttribute('aria-hidden', 'false');
    }).catch(function () {
      setStatus('err', 'Something went wrong. Please email hello@nikhilailabs.com or try again.');
      btn.disabled = false;
      btn.style.opacity = '';
      btn.style.cursor = '';
      btn.innerHTML = label;
      setTimeout(function () { submitting = false; }, 3000); // brief cooldown
    });
  });
})();
