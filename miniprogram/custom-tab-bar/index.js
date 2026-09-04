Component({
  data: {
    selected: 0,
    list: [
      { pagePath: '/pages/index/index', icon: '⌂', text: '活动' },
      { pagePath: '/pages/ranking/ranking', icon: '◈', text: '排行榜' },
      { pagePath: '/pages/profile/profile', icon: '◉', text: '我的' }
    ]
  },

  methods: {
    switchTab(e) {
      const { index, path } = e.currentTarget.dataset;
      if (index === this.data.selected) return;
      wx.switchTab({ url: path });
    }
  }
});
