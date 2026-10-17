(() => {
    const imageInput = document.querySelector("[data-image-input]");
    const imagePreview = document.querySelector("[data-image-preview]");
    const videoInput = document.querySelector("[data-video-input]");
    const videoPreview = document.querySelector("[data-video-preview]");

    let imageUrl = "";
    let videoUrl = "";

    const clearPreviewUrl = (url) => {
        if (url) URL.revokeObjectURL(url);
    };

    imageInput?.addEventListener("change", () => {
        const file = imageInput.files?.[0];
        if (!file || !imagePreview) return;
        if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) {
            imageInput.value = "";
            imagePreview.hidden = true;
            window.alert("กรุณาเลือกไฟล์รูปภาพขนาดไม่เกิน 10 MB");
            return;
        }
        clearPreviewUrl(imageUrl);
        imageUrl = URL.createObjectURL(file);
        imagePreview.querySelector("img").src = imageUrl;
        imagePreview.hidden = false;
    });

    videoInput?.addEventListener("change", () => {
        const file = videoInput.files?.[0];
        if (!file || !videoPreview) return;
        if (!file.type.startsWith("video/") || file.size > 100 * 1024 * 1024) {
            videoInput.value = "";
            window.alert("กรุณาเลือกไฟล์วิดีโอขนาดไม่เกิน 100 MB");
            return;
        }
        clearPreviewUrl(videoUrl);
        videoUrl = URL.createObjectURL(file);
        videoPreview.src = videoUrl;
        videoPreview.hidden = false;
        videoPreview.onloadedmetadata = () => {
            if (videoPreview.duration <= 180) return;
            videoInput.value = "";
            videoPreview.removeAttribute("src");
            videoPreview.hidden = true;
            clearPreviewUrl(videoUrl);
            videoUrl = "";
            window.alert("วิดีโอต้องมีความยาวไม่เกิน 3 นาที");
        };
    });

    document.querySelector("[data-image-preview] [data-action='remove-image']")?.addEventListener("click", () => {
        clearPreviewUrl(imageUrl);
        imageUrl = "";
        if (imageInput) imageInput.value = "";
        if (imagePreview) imagePreview.hidden = true;
    });
})();
