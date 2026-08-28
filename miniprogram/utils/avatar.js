// 头像加载失败时标记到 brokenAvatars，WXML 据此回落到昵称首字母
// key 需为合法标识符（字母/数字，不含点号），因为 setData 路径以点号分层
function onAvatarError(e, page) {
  const key = e.currentTarget.dataset.key;
  if (!key) return;
  page.setData({ ['brokenAvatars.' + key]: true });
}

module.exports = { onAvatarError };
