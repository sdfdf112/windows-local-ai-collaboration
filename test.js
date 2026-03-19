
    const aiStatus = [
      { name: 'Wisp', port: 18789, online: false },
      { name: 'Spark', port: 19000, online: false },
      { name: 'Cipher', port: 19100, online: false },
      { name: 'Nexus', port: 19200, online: false }
    ];
    let messages = [];
    let tasks = [];
    
    function showTab(tab, evt) {
      document.querySelectorAll('.panel').forEach(p => p.style.display = 'none');
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.getElementById(tab).style.display = 'block';
      (evt || event).target.classList.add('active');
    }
    
    function checkStatus() {
      aiStatus.forEach(ai => {
        fetch('http://127.0.0.1:' + ai.port + '/', { mode: 'no-cors' })
          .then(() => { ai.online = true; })
          .catch(() => { ai.online = false; });
      });
      renderStatus();
    }
    
    function renderStatus() {
      document.getElementById('nodeList').innerHTML = aiStatus.map(ai => 
        '<div class="node-card"><span class="node-status" style="background:' + (ai.online ? '#4ade80' : '#9ca3af') + '"></span><span class="node-name">' + ai.name + '</span><span class="node-port">' + (ai.online ? '在线' : '离线') + ' 端口:' + ai.port + '</span></div>'
      ).join('');
    }
    
    function loadMessages() {
      fetch('/api/messages').then(r => r.json()).then(data => {
        messages = data;
        renderMessages();
      });
    }
    
    function renderMessages() {
      if (messages.length === 0) {
        document.getElementById('messageList').innerHTML = '<div class="empty">暂无消息</div>';
        return;
      }
      document.getElementById('messageList').innerHTML = messages.map(msg => 
        '<div class="message-card" onclick="viewMessage(' + msg.id + ')">' +
          '<div class="msg-card-header"><span class="msg-from">' + msg.from + '</span>' +
          (msg.to && msg.to.length ? '<span class="msg-to">→ ' + msg.to.join(',') + '</span>' : '') +
          '<span class="msg-id">#' + msg.id + '</span></div>' +
          '<div class="msg-card-content">' + msg.content + '</div>' +
          '<div class="msg-card-footer"><span>' + new Date(msg.timestamp).toLocaleString() + '</span><span class="msg-click">点击查看详情 →</span></div>' +
        '</div>'
      ).join('');
    }
    
    function viewMessage(id) {
      const msg = messages.find(m => m.id == id);
      if (!msg) return;
      document.getElementById('modalTitle').textContent = '消息 #' + msg.id;
      document.getElementById('modalBody').innerHTML = 
        '<div class="detail-row"><span class="detail-label">发送者:</span><span class="detail-value">' + msg.from + '</span></div>' +
        '<div class="detail-row"><span class="detail-label">接收者:</span><span class="detail-value">' + (msg.to ? msg.to.join(',') : '所有人') + '</span></div>' +
        '<div class="detail-row"><span class="detail-label">时间:</span><span class="detail-value">' + new Date(msg.timestamp).toLocaleString() + '</span></div>' +
        '<div class="detail-row"><span class="detail-label">类型:</span><span class="detail-value">' + (msg.type || '普通') + '</span></div>' +
        '<div class="detail-row"><span class="detail-label">内容:</span></div><div class="content-box">' + msg.content + '</div>';
      document.getElementById('modal').style.display = 'flex';
    }
    
    function closeModal() {
      document.getElementById('modal').style.display = 'none';
    }
    
    function loadTasks() {
      fetch('/api/tasks').then(r => r.json()).then(data => {
        if (data.content) parseTasks(data.content);
      });
    }
    
    function loadDiscussions() {
      fetch('/api/discussions').then(r => r.json()).then(data => {
        renderDiscussions(data);
      });
    }
    
    function renderDiscussions(discussions) {
      const container = document.getElementById('discussionList');
      if (!discussions || discussions.length === 0) {
        container.innerHTML = '<div class="empty">暂无讨论记录</div>';
        return;
      }
      container.innerHTML = discussions.map(d =>
        '<div class="discussion-card" onclick="viewDiscussion(\'' + d.filename + '\')">' +
          '<div class="discussion-title">' + d.title + '</div>' +
          '<div class="discussion-meta">' +
            '<span class="discussion-date">' + d.date + '</span>' +
          '</div>' +
        '</div>'
      ).join('');
    }
    
    function viewDiscussion(filename) {
      fetch('/api/discussion?file=' + encodeURIComponent(filename))
        .then(r => r.text())
        .then(content => {
          document.getElementById('modalTitle').textContent = '讨论详情';
          document.getElementById('modalBody').innerHTML = '<div class="content-box" style="white-space: pre-wrap;">' + content + '</div>';
          document.getElementById('modal').style.display = 'flex';
        });
    }
    
    function loadNotifications() {
      fetch('/api/notifications').then(r => r.json()).then(data => {
        renderNotifications(data.notifications || []);
      });
    }
    
    function renderNotifications(notifications) {
      const container = document.getElementById('notificationList');
      if (!notifications || notifications.length === 0) {
        container.innerHTML = '<div class="empty">暂无通知</div>';
        return;
      }
      container.innerHTML = notifications.map(n =>
        '<div class="notification-item">' +
          '<div class="notification-content">' + (n.content || n.message || JSON.stringify(n)) + '</div>' +
          '<div class="notification-time">' + new Date(n.timestamp || n.time).toLocaleString() + '</div>' +
        '</div>'
      ).join('');
    }
    
    function parseTasks(content) {
      const lines = content.split('\\n');
      tasks = [];
      for (const line of lines) {
        const match = line.match(/^-\s*\[([ x~])\]\s*(.+?)(?:\s*-\s*负责人:\s*(\w+))?/);
        if (match) {
          tasks.push({ status: match[1], text: match[2].trim(), owner: match[3] || '' });
        }
      }
      renderTasks();
    }
    
    function renderTasks() {
      if (tasks.length === 0) {
        document.getElementById('taskList').innerHTML = '<div class="empty">暂无任务</div>';
        return;
      }
      document.getElementById('taskList').innerHTML = tasks.map(t => 
        '<div class="task-item">' +
          '<input type="checkbox" ' + (t.status === 'x' ? 'checked' : '') + ' disabled />' +
          '<span class="task-text ' + (t.status === 'x' ? 'done' : '') + '">' + t.text + '</span>' +
          (t.owner ? '<span class="task-owner">' + t.owner + '</span>' : '') +
        '</div>'
      ).join('');
    }
    
    // 初始化
    checkStatus();
    setInterval(checkStatus, 3000);
    loadMessages();
    loadTasks();
    loadDiscussions();
    loadNotifications();
    setInterval(loadMessages, 5000);
    setInterval(loadDiscussions, 10000);
    setInterval(loadNotifications, 10000);
  