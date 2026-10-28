const U = initShell(['STUDENT', 'TEACHER', 'ADMIN']);
const C = $('#content');
async function load() {
  const p = await api('/profile');
  C.innerHTML = `<h1 class="page-title">My Profile</h1>
  <div class="card"><div class="profile-head">${avatarHtml(p)}<div style="flex:1"><h2 style="margin:0">${esc(p.name)}</h2><span class="muted">${esc(p.user_code)} · ${esc(p.role)} · ${esc(p.email)}</span>
    <div style="margin-top:10px"><input type="file" id="photo" accept="image/png,image/jpeg,image/gif,image/webp" hidden><button class="btn primary sm" id="pickPhoto">📷 Upload profile picture</button> <span class="muted" style="font-size:.8rem">JPG/PNG/GIF/WEBP, max 2 MB</span></div></div></div></div>
  <div class="grid two"><form class="card" id="pf"><h3>Edit details</h3><label>${esc(p.role === 'STUDENT' ? 'Student' : p.role === 'TEACHER' ? 'Teacher' : 'Admin')} ID</label><input value="${esc(p.user_code)}" disabled><label>Name</label><input id="p_name" required value="${esc(p.name)}">
    <label>Email</label><input id="p_email" required value="${esc(p.email)}"><label>Phone</label><input id="p_phone" value="${esc(p.phone || '')}"><label>Bio</label><textarea id="p_bio">${esc(p.bio || '')}</textarea><button class="btn primary" style="margin-top:14px">Save profile</button></form>
  <form class="card" id="pw"><h3>Change password</h3><label>Current Password</label><div class="pw-wrap"><input id="c_pw" type="password" required><button class="eye">👁️</button></div>
    <label>New Password</label><div class="pw-wrap"><input id="n_pw" type="password" minlength="6" required><button class="eye">👁️</button></div><label>Confirm New Password</label><div class="pw-wrap"><input id="f_pw" type="password" minlength="6" required><button class="eye">👁️</button></div>
    <button class="btn primary" style="margin-top:14px">Update password</button></form></div>`;
  initEyes();
  $('#pickPhoto').onclick = () => $('#photo').click();
  $('#photo').onchange = async () => {
    const f = $('#photo').files[0]; if (!f) return; const fd = new FormData(); fd.append('photo', f);
    try { const d = await api('/profile/photo', { method: 'POST', form: fd }); store.setUser({ ...store.user, photo: d.photo }); toast(d.message); location.reload(); } catch (e) { toast(e.message, 'err'); }
  };
  $('#pf').onsubmit = async (e) => {
    e.preventDefault();
    try { const d = await api('/profile', { method: 'PUT', body: { name: $('#p_name').value.trim(), email: $('#p_email').value.trim(), phone: $('#p_phone').value.trim(), bio: $('#p_bio').value.trim() } });
      store.setUser({ ...store.user, name: d.user.name, email: d.user.email }); toast(d.message); location.reload(); } catch (err) { toast(err.message, 'err'); }
  };
  $('#pw').onsubmit = async (e) => {
    e.preventDefault();
    try { const d = await api('/profile/password', { method: 'PUT', body: { currentPassword: $('#c_pw').value, newPassword: $('#n_pw').value, confirmPassword: $('#f_pw').value } }); toast(d.message); $('#pw').reset(); } catch (err) { toast(err.message, 'err'); }
  };
}
if (U) load().catch((e) => { C.innerHTML = `<div class="card err">${esc(e.message)}</div>`; });
