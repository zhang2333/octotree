;(function () {
  const q = qs => document.querySelector(qs)
  function requestPermission(url) {
    chrome.permissions.request({
      origins: [url],
      // origins: ['http://www.google.com/']
    }, function(granted) {
      console.log(granted)
    })
  }

  q('.btn-add').addEventListener('click', () => {
    const url = q('.input').value.trim()
    if (url) {
      requestPermission(url)
    }
  })
})()
