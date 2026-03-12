{ pkgs }: {
    deps = [
        pkgs.nodejs-18_x
    ];
}
<script>
    // Register the Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js');
    }

    function launch() {
        const url = document.getElementById('urlInput').value;
        window.location.href = `/fetch?url=${encodeURIComponent(url)}`;
    }
</script>
<input id="urlInput" placeholder="https://google.com">
<button onclick="launch()">Go</button>
