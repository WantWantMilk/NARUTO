// app.js - 主逻辑
// 从 config.js 中读取密钥（部署时动态生成）
const SUPABASE_URL = window.SUPABASE_CONFIG.url;
const SUPABASE_ANON_KEY = window.SUPABASE_CONFIG.anonKey;

// 初始化 Supabase 客户端
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---------- 全局状态 ----------
let currentUser = null;
let currentPage = 'browse';
const ANONYMOUS_LIMIT = 10;
const USER_LIMIT = 50;

// DOM 元素
const appContainer = document.getElementById('app');
const navLinks = document.querySelectorAll('[data-page]');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const privacyLink = document.getElementById('privacyLink');
const privacyModal = document.getElementById('privacyModal');
const closePrivacy = document.getElementById('closePrivacy');
const navToggle = document.getElementById('navToggle');
const navLinksContainer = document.getElementById('navLinks');

// ---------- 路由与认证监听 ----------
async function initAuth() {
  const { data: { user } } = await supabase.auth.getUser();
  currentUser = user;
  updateAuthUI();
  renderPage(currentPage);
}

supabase.auth.onAuthStateChange((event, session) => {
  currentUser = session?.user ?? null;
  updateAuthUI();
  if (currentPage === 'account' && !currentUser) {
    navigateTo('browse');
  } else {
    renderPage(currentPage);
  }
});

function updateAuthUI() {
  if (currentUser) {
    loginBtn.style.display = 'none';
    logoutBtn.style.display = 'inline-block';
    logoutBtn.textContent = `登出 (${currentUser.email || '匿名'})`;
  } else {
    loginBtn.style.display = 'inline-block';
    logoutBtn.style.display = 'none';
  }
}

// 导航
navLinks.forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const page = link.dataset.page;
    navigateTo(page);
  });
});

function navigateTo(page) {
  if (page === 'account' && !currentUser) {
    alert('请先登录');
    return;
  }
  currentPage = page;
  navLinks.forEach(l => l.classList.remove('active'));
  document.querySelector(`[data-page="${page}"]`)?.classList.add('active');
  renderPage(page);
}

// 页面渲染
function renderPage(page) {
  switch (page) {
    case 'browse':
      renderBrowse();
      break;
    case 'upload':
      renderUpload();
      break;
    case 'account':
      renderAccount();
      break;
    default:
      renderBrowse();
  }
}

// ---------- 浏览页面 ----------
async function renderBrowse() {
  appContainer.innerHTML = `<div class="gallery" id="galleryContainer">加载中...</div>`;
  try {
    const { data: wallpapers, error } = await supabase
      .from('wallpapers')
      .select('*')
      .eq('privacy', 'public')
      .order('inserted_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    if (wallpapers.length === 0) {
      document.getElementById('galleryContainer').innerHTML = '<p>暂无公开壁纸，快去上传第一张吧！</p>';
      return;
    }
    const html = wallpapers.map(w => `
      <div class="card">
        <img src="${w.url}" alt="${escapeHtml(w.title || 'NARUTO壁纸')}" loading="lazy" onerror="this.src='data:image/svg+xml,...'">
        <div class="card-body">
          <div class="card-title">${escapeHtml(w.title || '未命名')}</div>
          <div class="card-meta">
            <span>${escapeHtml(w.author_name || '匿名')}</span>
            <a href="${w.url}" download class="download-btn" target="_blank">下载</a>
          </div>
        </div>
      </div>
    `).join('');
    document.getElementById('galleryContainer').innerHTML = html;
  } catch (error) {
    document.getElementById('galleryContainer').innerHTML = `<p>加载失败: ${error.message}</p>`;
  }
}

// ---------- 上传页面 ----------
function renderUpload() {
  appContainer.innerHTML = `
    <section class="upload-section">
      <h2>上传壁纸</h2>
      <div class="form-group">
        <label for="uploadMethod">上传方式</label>
        <select id="uploadMethod">
          <option value="file">本地文件</option>
          <option value="url">图片 URL</option>
        </select>
      </div>
      <div id="fileUploadArea" class="form-group">
        <div class="file-drop-zone" id="dropZone">
          <p>拖拽图片到此处，或点击选择</p>
          <input type="file" id="fileInput" accept="image/*" class="visually-hidden">
        </div>
        <progress id="uploadProgress" value="0" max="100" style="width:100%; display:none;"></progress>
      </div>
      <div id="urlUploadArea" class="form-group" style="display:none;">
        <label for="imageUrl">图片 URL</label>
        <input type="url" id="imageUrl" placeholder="https://example.com/naruto.jpg">
      </div>
      <div class="form-group">
        <label for="wallpaperTitle">标题（选填）</label>
        <input type="text" id="wallpaperTitle" placeholder="为壁纸取个名字">
      </div>
      <div class="form-group" id="privacyGroup">
        <label for="privacySelect">隐私设置</label>
        <select id="privacySelect">
          <option value="public">公开</option>
          ${currentUser ? '<option value="private">私密</option>' : ''}
        </select>
        ${!currentUser ? '<small style="color:#e67e22;">未登录仅能上传公开壁纸，限制10张（文件上传）</small>' : ''}
      </div>
      <button class="btn-primary" id="uploadBtn">上传</button>
      <p id="uploadMsg" style="margin-top:1rem;"></p>
    </section>
  `;

  // 切换上传方式
  const methodSelect = document.getElementById('uploadMethod');
  const fileArea = document.getElementById('fileUploadArea');
  const urlArea = document.getElementById('urlUploadArea');
  methodSelect.addEventListener('change', () => {
    if (methodSelect.value === 'file') {
      fileArea.style.display = 'block';
      urlArea.style.display = 'none';
    } else {
      fileArea.style.display = 'none';
      urlArea.style.display = 'block';
    }
  });

  // 拖拽上传
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.style.background = '#fcf9f2'; });
  dropZone.addEventListener('dragleave', () => dropZone.style.background = '');
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.style.background = '';
    const files = e.dataTransfer.files;
    if (files.length) fileInput.files = files;
  });

  document.getElementById('uploadBtn').addEventListener('click', handleUpload);
}

async function handleUpload() {
  const msg = document.getElementById('uploadMsg');
  const method = document.getElementById('uploadMethod').value;
  const title = document.getElementById('wallpaperTitle').value || '未命名';
  const privacy = document.getElementById('privacySelect').value;
  const uploadBtn = document.getElementById('uploadBtn');

  uploadBtn.disabled = true;
  msg.textContent = '';

  // 检查上传配额
  if (!currentUser && method === 'file') {
    try {
      const ipResponse = await fetch('https://api.ipify.org?format=json');
      const ipData = await ipResponse.json();
      const userIp = ipData.ip;
      const { data: countData, error: countError } = await supabase
        .from('anonymous_uploads')
        .select('upload_count')
        .eq('user_ip', userIp)
        .single();
      if (countError && countError.code !== 'PGRST116') throw countError;
      const currentCount = countData?.upload_count || 0;
      if (currentCount >= ANONYMOUS_LIMIT) {
        msg.textContent = '匿名用户文件上传已达上限（10张），请登录后继续。';
        uploadBtn.disabled = false;
        return;
      }
    } catch (error) {
      msg.textContent = `检查上传额度失败: ${error.message}`;
      uploadBtn.disabled = false;
      return;
    }
  } else if (currentUser) {
    const { data: userWallpapers, error: countError } = await supabase
      .from('wallpapers')
      .select('id')
      .eq('author_id', currentUser.id)
      .eq('privacy', privacy);
    if (countError) {
      msg.textContent = `检查上传额度失败: ${countError.message}`;
      uploadBtn.disabled = false;
      return;
    }
    if (userWallpapers.length >= USER_LIMIT) {
      msg.textContent = `已达到${privacy === 'public' ? '公开' : '私密'}壁纸上限（${USER_LIMIT}张）。`;
      uploadBtn.disabled = false;
      return;
    }
  }

  let downloadURL;
  try {
    if (method === 'url') {
      downloadURL = document.getElementById('imageUrl').value.trim();
      if (!downloadURL) throw new Error('请输入图片URL');
      new URL(downloadURL);
    } else {
      const file = document.getElementById('fileInput').files[0];
      if (!file) throw new Error('请选择文件');
      const progress = document.getElementById('uploadProgress');
      progress.style.display = 'block';
      const fileName = `${Date.now()}_${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('wallpapers')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
          onUploadProgress: (progressEvent) => {
            const percent = (progressEvent.loaded / progressEvent.total) * 100;
            progress.value = percent;
          }
        });
      if (uploadError) throw uploadError;
      const { data: publicUrlData } = supabase.storage
        .from('wallpapers')
        .getPublicUrl(fileName);
      downloadURL = publicUrlData.publicUrl;
    }

    // 保存到数据库
    const docData = {
      url: downloadURL,
      title: title,
      privacy: privacy,
      author_id: currentUser?.id || null,
      author_name: currentUser ? (currentUser.email || '用户') : '匿名',
      upload_method: method
    };
    const { error: insertError } = await supabase
      .from('wallpapers')
      .insert(docData);
    if (insertError) throw insertError;

    // 匿名计数更新
    if (!currentUser && method === 'file') {
      try {
        const ipResponse = await fetch('https://api.ipify.org?format=json');
        const ipData = await ipResponse.json();
        const userIp = ipData.ip;
        const { data: existingData, error: fetchError } = await supabase
          .from('anonymous_uploads')
          .select('*')
          .eq('user_ip', userIp)
          .single();
        if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;
        if (existingData) {
          const { error: updateError } = await supabase
            .from('anonymous_uploads')
            .update({ upload_count: existingData.upload_count + 1 })
            .eq('user_ip', userIp);
          if (updateError) throw updateError;
        } else {
          const { error: insertError } = await supabase
            .from('anonymous_uploads')
            .insert({ user_ip: userIp, upload_count: 1 });
          if (insertError) throw insertError;
        }
      } catch (error) {
        console.error('更新匿名计数失败:', error);
        msg.textContent = '上传成功，但计数更新失败，请联系管理员。';
        uploadBtn.disabled = false;
        return;
      }
    }

    msg.textContent = '上传成功！';
    if (method === 'file') document.getElementById('fileInput').value = '';
    else document.getElementById('imageUrl').value = '';
    document.getElementById('uploadProgress').style.display = 'none';
  } catch (error) {
    msg.textContent = `上传失败: ${error.message}`;
  } finally {
    uploadBtn.disabled = false;
  }
}

// ---------- 账户页面 ----------
function renderAccount() {
  if (!currentUser) return;
  appContainer.innerHTML = `
    <div class="account-container">
      <h2>我的壁纸</h2>
      <div class="tabs">
        <button class="tab-btn active" data-tab="public">公开</button>
        <button class="tab-btn" data-tab="private">私密</button>
      </div>
      <div id="tabContent"></div>
    </div>
  `;
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => btn.addEventListener('click', async (e) => {
    tabBtns.forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    await loadUserWallpapers(e.target.dataset.tab);
  }));
  loadUserWallpapers('public');
}

async function loadUserWallpapers(privacy) {
  const content = document.getElementById('tabContent');
  content.innerHTML = '加载中...';
  try {
    const { data: wallpapers, error } = await supabase
      .from('wallpapers')
      .select('*')
      .eq('author_id', currentUser.id)
      .eq('privacy', privacy)
      .order('inserted_at', { ascending: false });
    if (error) throw error;
    if (wallpapers.length === 0) {
      content.innerHTML = `<p>还没有${privacy === 'public' ? '公开' : '私密'}壁纸。</p>`;
      return;
    }
    content.innerHTML = wallpapers.map(w => `
      <div class="wallpaper-item">
        <img src="${w.url}" alt="${escapeHtml(w.title)}">
        <div class="item-info">
          <strong>${escapeHtml(w.title)}</strong>
          <div class="card-meta">上传方式：${w.upload_method}</div>
        </div>
        <div class="item-actions">
          <button class="delete-btn" data-id="${w.id}">删除</button>
          <button class="toggle-privacy-btn" data-id="${w.id}" data-newprivacy="${w.privacy === 'public' ? 'private' : 'public'}">
            改为${w.privacy === 'public' ? '私密' : '公开'}
          </button>
        </div>
      </div>
    `).join('');

    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.dataset.id;
        if (confirm('确定删除？')) {
          try {
            const { error } = await supabase
              .from('wallpapers')
              .delete()
              .eq('id', id);
            if (error) throw error;
            loadUserWallpapers(privacy);
          } catch (error) {
            alert('删除失败: ' + error.message);
          }
        }
      });
    });
    document.querySelectorAll('.toggle-privacy-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.dataset.id;
        const newPrivacy = e.target.dataset.newprivacy;
        try {
          const { data: countData, error: countError } = await supabase
            .from('wallpapers')
            .select('id')
            .eq('author_id', currentUser.id)
            .eq('privacy', newPrivacy);
          if (countError) throw countError;
          if (countData.length >= USER_LIMIT) {
            alert(`${newPrivacy === 'public' ? '公开' : '私密'}壁纸已达上限（${USER_LIMIT}张），无法更改。`);
            return;
          }
          const { error: updateError } = await supabase
            .from('wallpapers')
            .update({ privacy: newPrivacy })
            .eq('id', id);
          if (updateError) throw updateError;
          loadUserWallpapers(privacy);
        } catch (error) {
          alert('更改隐私设置失败: ' + error.message);
        }
      });
    });
  } catch (error) {
    content.innerHTML = `加载失败: ${error.message}`;
  }
}

// ---------- 登录/登出 ----------
loginBtn.addEventListener('click', async () => {
  const email = prompt('请输入邮箱地址注册/登录：');
  if (!email) return;
  const password = prompt('请输入密码（至少6位）：');
  if (!password) return;
  try {
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      if (signInError.message.includes('Invalid login credentials')) {
        const { error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) throw signUpError;
        alert('注册成功！请检查邮箱并确认账号。');
      } else {
        throw signInError;
      }
    }
  } catch (err) {
    alert('登录/注册失败: ' + err.message);
  }
});

logoutBtn.addEventListener('click', async () => {
  const { error } = await supabase.auth.signOut();
  if (error) alert('登出失败: ' + error.message);
});

// 隐私弹窗
privacyLink.addEventListener('click', (e) => {
  e.preventDefault();
  privacyModal.style.display = 'flex';
});
closePrivacy.addEventListener('click', () => privacyModal.style.display = 'none');
window.addEventListener('click', (e) => {
  if (e.target === privacyModal) privacyModal.style.display = 'none';
});

// 移动端菜单
navToggle.addEventListener('click', () => {
  navLinksContainer.classList.toggle('show');
});

// 工具函数
function escapeHtml(text) {
  const map = {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'};
  return text.replace(/[&<>"']/g, m => map[m]);
}

// 初始渲染
initAuth();