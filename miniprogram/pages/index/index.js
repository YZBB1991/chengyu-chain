const app = getApp();

Page({
  data: {
    url: ""
  },

  onLoad(query) {
    let url = app.globalData.h5Url;
    // 支持通过小程序启动参数透传，例如 ?mode=strict 直接进入严格模式
    const params = [];
    if (query && query.mode) params.push("mode=" + encodeURIComponent(query.mode));
    if (params.length) {
      url += (url.indexOf("?") >= 0 ? "&" : "?") + params.join("&");
    }
    this.setData({ url });
  },

  onWebviewLoad() {
    // H5 加载完成
  },

  onWebviewError(e) {
    console.error("web-view 加载失败：", e);
  },

  // 转发给好友
  onShareAppMessage() {
    return {
      title: "成语接龙 · 闯关 — 单人打 AI，你接得住吗？",
      path: "/pages/index/index"
    };
  },

  // 分享到朋友圈
  onShareTimeline() {
    return {
      title: "成语接龙 · 闯关 — 单人打 AI，你接得住吗？"
    };
  }
});
