(() => {
    const storageKeys = {
        posts: "learnlink.posts.v1",
        likes: "learnlink.likes.v1",
        saved: "learnlink.saved.v1",
        comments: "learnlink.comments.v1",
    };

    const readStorage = (key, fallback) => {
        try {
            const value = localStorage.getItem(key);
            return value ? JSON.parse(value) : fallback;
        } catch (error) {
            console.error(`Could not read LearnLink browser data (${key}).`, error);
            return fallback;
        }
    };

    const writeStorage = (key, value) => {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error(`Could not save LearnLink browser data (${key}).`, error);
            showToast("บันทึกข้อมูลในเบราว์เซอร์ไม่สำเร็จ");
            return false;
        }
    };

    let toastTimer;
    const showToast = (message) => {
        let toast = document.querySelector("[data-toast]");
        if (!toast) {
            toast = document.createElement("div");
            toast.className = "toast-message";
            toast.dataset.toast = "";
            toast.setAttribute("role", "status");
            toast.setAttribute("aria-live", "polite");
            document.body.append(toast);
        }
        toast.textContent = message;
        toast.classList.add("is-visible");
        window.clearTimeout(toastTimer);
        toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 2600);
    };

    const readArray = (key) => {
        const value = readStorage(key, []);
        return Array.isArray(value) ? value : [];
    };

    const currentUserName = (
        document.body.dataset.currentUser
        || document.querySelector(".sidebar-profile-name")?.textContent
        || "ผู้เรียน LearnLink"
    ).trim();
    const savedPosts = new Set(readArray(storageKeys.saved));
    const likedPosts = new Set(readArray(storageKeys.likes));
    const storedComments = readStorage(storageKeys.comments, {});
    const savedComments = storedComments && typeof storedComments === "object" && !Array.isArray(storedComments)
        ? storedComments
        : {};
    const feedList = document.querySelector("[data-feed-list]");
    const searchInput = document.querySelector("[data-search-input], .prototype-topbar .search input");
    let savedOnly = false;
    let activeQuery = (searchInput?.value || "").trim().toLocaleLowerCase();

    const createElement = (tag, className, text) => {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (text !== undefined) element.textContent = text;
        return element;
    };

    const normalizeComments = (comments) => comments.map((comment, index) => {
        if (typeof comment === "string") {
            return {
                id: `legacy-${index}`,
                author: currentUserName,
                content: comment,
                createdAt: new Date().toISOString(),
            };
        }
        if (!comment || typeof comment.content !== "string") return null;
        return {
            id: typeof comment.id === "string" ? comment.id : `legacy-${index}`,
            author: typeof comment.author === "string" ? comment.author : currentUserName,
            content: comment.content,
            createdAt: typeof comment.createdAt === "string" ? comment.createdAt : new Date().toISOString(),
        };
    }).filter(Boolean);

    const createInlineEditor = (value, onSave, onCancel) => {
        const form = createElement("form", "inline-edit-form");
        const input = createElement("textarea", "inline-edit-input");
        input.value = value;
        input.rows = 3;
        input.required = true;
        const actions = createElement("div", "inline-edit-actions");
        const save = createElement("button", "button-primary", "บันทึก");
        save.type = "submit";
        const cancel = createElement("button", "button-secondary", "ยกเลิก");
        cancel.type = "button";
        cancel.addEventListener("click", onCancel);
        actions.append(save, cancel);
        form.append(input, actions);
        form.addEventListener("submit", (event) => {
            event.preventDefault();
            const content = input.value.trim();
            if (content) onSave(content);
        });
        return form;
    };

    const createPostCard = (post) => {
        const card = createElement("article", "card post-card");
        card.dataset.postCard = "";
        card.dataset.localPostId = post.id;
        card.dataset.topic = post.kind || "";
        card.dataset.postKey = `local-${post.id}`;

        const header = createElement("header", "post-header");
        const avatar = createElement("span", "avatar", post.author.slice(0, 1).toUpperCase());
        const author = createElement("div", "post-author");
        author.append(createElement("strong", "", post.author));
        const meta = createElement("span", "post-meta", new Date(post.createdAt).toLocaleString("th-TH"));
        author.append(meta);
        const share = createElement("button", "post-menu", "↗");
        share.type = "button";
        share.setAttribute("aria-label", "แชร์โพสต์");
        share.dataset.action = "share";
        header.append(avatar, author);
        if (post.author === currentUserName && post.id) {
            const ownerActions = createElement("div", "post-owner-actions");
            const edit = createElement("button", "post-menu", "✎");
            edit.type = "button";
            edit.dataset.postEdit = "";
            edit.setAttribute("aria-label", "แก้ไขโพสต์");
            const remove = createElement("button", "post-menu post-delete-action", "×");
            remove.type = "button";
            remove.dataset.postDelete = "";
            remove.setAttribute("aria-label", "ลบโพสต์");
            ownerActions.append(edit, remove, share);
            header.append(ownerActions);
        } else {
            header.append(share);
        }
        card.append(header);

        if (post.kind) card.append(createElement("span", "post-community", `#${post.kind}`));
        card.append(createElement("div", "post-content", post.content));
        if (post.image) {
            const image = createElement("img", "post-image");
            image.src = post.image;
            image.alt = "ภาพประกอบโพสต์";
            image.loading = "lazy";
            card.append(image);
        }

        const stats = createElement("div", "post-stats");
        stats.append(createElement("span", "", "0 ถูกใจ"));
        stats.lastElementChild.dataset.likeCount = "";
        stats.append(createElement("span", "", "0 ความคิดเห็น"));
        stats.lastElementChild.dataset.commentCount = "";
        card.append(stats);

        const actions = createElement("div", "post-actions");
        const like = createElement("button", "post-action", "♡ ถูกใจ");
        like.type = "button";
        like.dataset.action = "like";
        like.setAttribute("aria-pressed", "false");
        const comment = createElement("button", "post-action", "▢ แสดงความคิดเห็น");
        comment.type = "button";
        comment.dataset.action = "comment";
        const save = createElement("button", "post-action", "♧ บันทึก");
        save.type = "button";
        save.dataset.action = "save";
        save.setAttribute("aria-pressed", "false");
        actions.append(like, comment, save);
        card.append(actions);
        const commentArea = createElement("div", "comment-area");
        commentArea.dataset.commentArea = "";
        commentArea.hidden = true;
        card.append(commentArea);
        return card;
    };

    const hashText = (value) => {
        let hash = 2166136261;
        for (let index = 0; index < value.length; index += 1) {
            hash ^= value.charCodeAt(index);
            hash = Math.imul(hash, 16777619);
        }
        return (hash >>> 0).toString(36);
    };

    const getPostKey = (card) => {
        if (!card.dataset.postKey && card.dataset.localPostId) {
            card.dataset.postKey = `local-${card.dataset.localPostId}`;
        } else if (!card.dataset.postKey && card.dataset.serverPostId) {
            card.dataset.postKey = `server-${card.dataset.serverPostId}`;
        } else if (!card.dataset.postKey) {
            const source = [
                card.querySelector(".post-author strong")?.textContent || "",
                card.querySelector(".post-meta")?.textContent || "",
                card.querySelector(".post-content")?.textContent || "",
            ].join("|");
            card.dataset.postKey = `server-${hashText(source)}`;
        }
        card.id = `post-${card.dataset.postKey}`;
        return card.dataset.postKey;
    };

    const baseCount = (card, selector) => {
        const element = card.querySelector(selector);
        if (!element) return 0;
        if (element.dataset.baseCount === undefined) {
            const parsed = Number.parseInt(element.textContent.replace(/[^\d]/g, ""), 10);
            element.dataset.baseCount = String(Number.isNaN(parsed) ? 0 : parsed);
        }
        return Number.parseInt(element.dataset.baseCount, 10);
    };

    const updatePostControls = (card) => {
        const key = getPostKey(card);
        const likeButton = card.querySelector('[data-action="like"]');
        const saveButton = card.querySelector('[data-action="save"]');
        if (likeButton) {
            const liked = likedPosts.has(key);
            likeButton.setAttribute("aria-pressed", String(liked));
            const count = baseCount(card, "[data-like-count]") + Number(liked);
            const counter = card.querySelector("[data-like-count]");
            if (counter) counter.textContent = `${count} ถูกใจ`;
            likeButton.textContent = liked ? "♥ ถูกใจแล้ว" : "♡ ถูกใจ";
        }
        if (saveButton) {
            const saved = savedPosts.has(key);
            saveButton.setAttribute("aria-pressed", String(saved));
            saveButton.textContent = saved ? "♧ บันทึกแล้ว" : "♧ บันทึก";
        }
        const comments = normalizeComments(Array.isArray(savedComments[key]) ? savedComments[key] : []);
        const count = baseCount(card, "[data-comment-count]") + comments.length;
        const commentCounter = card.querySelector("[data-comment-count]");
        if (commentCounter) commentCounter.textContent = `${count} ความคิดเห็น`;
        const commentArea = card.querySelector("[data-comment-area]");
        if (commentArea) renderComments(commentArea, comments);
    };

    const renderComments = (area, comments) => {
        let list = area.querySelector(".comment-list");
        if (!list) {
            list = createElement("div", "comment-list");
            area.prepend(list);
        }
        const card = area.closest("[data-post-card]");
        const key = card ? getPostKey(card) : "";
        const normalized = normalizeComments(comments);
        list.replaceChildren(...normalized.map((comment) => {
            const item = createElement("div", "comment-item");
            const body = createElement("div", "comment-item-body");
            body.append(createElement("strong", "comment-author", comment.author));
            body.append(createElement("p", "comment-content", comment.content));
            item.append(body);
            if (comment.author === currentUserName && key) {
                const controls = createElement("div", "comment-owner-actions");
                const edit = createElement("button", "comment-owner-action", "แก้ไข");
                edit.type = "button";
                edit.dataset.commentEdit = comment.id;
                const remove = createElement("button", "comment-owner-action comment-delete-action", "ลบ");
                remove.type = "button";
                remove.dataset.commentDelete = comment.id;
                controls.append(edit, remove);
                item.append(controls);
            }
            return item;
        }));
    };

    const filterPosts = () => {
        if (!feedList) return;
        const cards = [...feedList.querySelectorAll("[data-post-card]")];
        let visibleCount = 0;
        for (const card of cards) {
            const key = getPostKey(card);
            const topic = (card.dataset.topic || "").toLocaleLowerCase();
            const matchesText = !activeQuery || card.textContent.toLocaleLowerCase().includes(activeQuery);
            const matchesTopic = !activeQuery.startsWith("#")
                || topic.includes(activeQuery.slice(1))
                || card.textContent.toLocaleLowerCase().includes(activeQuery);
            const visible = matchesText && matchesTopic && (!savedOnly || savedPosts.has(key));
            card.hidden = !visible;
            if (visible) visibleCount += 1;
        }

        let message = feedList.querySelector("[data-filter-message]");
        if (!message) {
            message = createElement("p", "feed-message");
            message.dataset.filterMessage = "";
            message.hidden = true;
            feedList.append(message);
        }
        const filtering = Boolean(activeQuery || savedOnly);
        message.hidden = !filtering || visibleCount > 0;
        message.textContent = savedOnly
            ? "ยังไม่มีโพสต์ที่บันทึกไว้"
            : "ไม่พบโพสต์ที่ตรงกับคำค้นหา";

        const emptyState = feedList.querySelector("[data-empty-state]");
        if (emptyState) emptyState.hidden = cards.length > 0;
        const count = document.querySelector("[data-post-count]");
        if (count && !activeQuery && !savedOnly) count.textContent = `${cards.length} โพสต์`;
    };

    const showCommentForm = (card) => {
        const area = card.querySelector("[data-comment-area]");
        if (!area) return;
        area.hidden = false;
        let form = area.querySelector(".comment-form");
        if (!form) {
            form = createElement("form", "comment-form");
            const input = createElement("input", "comment-input");
            input.type = "text";
            input.name = "comment";
            input.placeholder = "เขียนความคิดเห็น...";
            input.setAttribute("aria-label", "เขียนความคิดเห็น");
            input.required = true;
            const submit = createElement("button", "comment-submit", "ส่ง");
            submit.type = "submit";
            form.append(input, submit);
            form.addEventListener("submit", (event) => {
                event.preventDefault();
                const value = input.value.trim();
                if (!value) return;
                const key = getPostKey(card);
                const comments = normalizeComments(Array.isArray(savedComments[key]) ? savedComments[key] : []);
                comments.push({
                    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                    author: currentUserName,
                    content: value,
                    createdAt: new Date().toISOString(),
                });
                if (!writeStorage(storageKeys.comments, { ...savedComments, [key]: comments })) return;
                savedComments[key] = comments;
                updatePostControls(card);
                input.value = "";
                input.focus();
            });
            area.append(form);
        }
        form.querySelector("input").focus();
    };

    const persistPost = (post) => {
        const posts = readArray(storageKeys.posts);
        posts.unshift(post);
        return writeStorage(storageKeys.posts, posts);
    };

    const restoreLocalPosts = () => {
        if (!feedList) return;
        const posts = readArray(storageKeys.posts);
        for (const post of posts.slice().reverse()) {
            if (!post || !post.id || typeof post.content !== "string") continue;
            feedList.prepend(createPostCard(post));
        }
        for (const card of feedList.querySelectorAll("[data-post-card]")) {
            updatePostControls(card);
        }
        filterPosts();
    };

    if (feedList) restoreLocalPosts();

    document.querySelector("[data-search-form]")?.addEventListener("submit", (event) => {
        event.preventDefault();
        searchInput?.blur();
    });

    searchInput?.addEventListener("input", () => {
        activeQuery = searchInput.value.trim().replace(/^#/, "#").toLocaleLowerCase();
        filterPosts();
    });

    document.querySelector("[data-composer]")?.addEventListener("submit", (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const input = form.querySelector("[data-composer-input]");
        const content = input.value.trim();
        if (!content) {
            input.setCustomValidity("เขียนสิ่งที่อยากแบ่งปันก่อนโพสต์");
            input.reportValidity();
            input.addEventListener("input", () => input.setCustomValidity(""), { once: true });
            return;
        }
        const post = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            author: currentUserName,
            content,
            kind: form.dataset.communityName || form.dataset.postKind || "",
            communityId: form.dataset.communityId || "",
            communityName: form.dataset.communityName || "",
            image: form.dataset.image || "",
            createdAt: new Date().toISOString(),
        };
        const card = createPostCard(post);
        feedList?.prepend(card);
        const emptyState = feedList?.querySelector("[data-empty-state]");
        if (emptyState) emptyState.hidden = true;
        const saved = persistPost(post);
        input.value = "";
        delete form.dataset.image;
        delete form.dataset.postKind;
        delete form.dataset.communityId;
        delete form.dataset.communityName;
        form.querySelectorAll("[data-post-kind]").forEach((button) => button.setAttribute("aria-pressed", "false"));
        const communityPicker = form.querySelector("[data-composer-community-picker]");
        if (communityPicker) {
            const label = communityPicker.querySelector("[data-composer-community-label]");
            if (label) label.textContent = "◎ เลือกชุมชน";
            communityPicker.open = false;
        }
        const preview = form.querySelector("[data-image-preview]");
        if (preview) preview.hidden = true;
        const fileInput = form.querySelector("[data-image-input]");
        if (fileInput) fileInput.value = "";
        updatePostControls(card);
        savedOnly = false;
        document.querySelectorAll("[data-feed-filter]").forEach((link) => {
            link.classList.toggle("is-active", link.dataset.feedFilter === "all");
        });
        filterPosts();
        showToast("โพสต์ของคุณถูกเพิ่มในฟีดบนอุปกรณ์นี้แล้ว");
        if (saved && post.communityId) {
            window.dispatchEvent(new CustomEvent("learnlink:community-post-created", {
                detail: { communityId: post.communityId },
            }));
        }
        card.scrollIntoView({ behavior: "smooth", block: "center" });
    });

    document.querySelector("[data-image-input]")?.addEventListener("change", (event) => {
        const file = event.currentTarget.files?.[0];
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            showToast("กรุณาเลือกไฟล์รูปภาพ");
            event.currentTarget.value = "";
            return;
        }
        if (file.size > 1024 * 1024) {
            showToast("รูปภาพต้องมีขนาดไม่เกิน 1 MB เพื่อบันทึกบนอุปกรณ์");
            event.currentTarget.value = "";
            return;
        }
        const reader = new FileReader();
        reader.addEventListener("load", () => {
            const form = document.querySelector("[data-composer]");
            if (!form || typeof reader.result !== "string") return;
            form.dataset.image = reader.result;
            const preview = form.querySelector("[data-image-preview]");
            preview.querySelector("img").src = reader.result;
            preview.hidden = false;
        });
        reader.addEventListener("error", () => showToast("อ่านรูปภาพไม่สำเร็จ กรุณาลองใหม่"));
        reader.readAsDataURL(file);
    });

    document.addEventListener("click", async (event) => {
        const target = event.target instanceof Element ? event.target : null;
        if (!target) return;

        const editPostButton = target.closest("[data-post-edit]");
        if (editPostButton) {
            const card = editPostButton.closest("[data-post-card]");
            const postId = card?.dataset.localPostId;
            const post = readArray(storageKeys.posts).find((item) => item.id === postId);
            const content = card?.querySelector(".post-content");
            if (!card || !post || post.author !== currentUserName || !content) return;
            if (card.querySelector(".inline-edit-form")) return;
            const editor = createInlineEditor(post.content, (updatedContent) => {
                const posts = readArray(storageKeys.posts);
                const index = posts.findIndex((item) => item.id === postId && item.author === currentUserName);
                if (index < 0) {
                    showToast("ไม่พบโพสต์นี้ หรือคุณไม่มีสิทธิ์แก้ไข");
                    return;
                }
                posts[index] = { ...posts[index], content: updatedContent, updatedAt: new Date().toISOString() };
                if (!writeStorage(storageKeys.posts, posts)) return;
                content.textContent = updatedContent;
                editor.remove();
                window.dispatchEvent(new CustomEvent("learnlink:community-post-updated", {
                    detail: { postId, communityId: post.communityId },
                }));
                filterPosts();
                showToast("แก้ไขโพสต์แล้ว");
            }, () => editor.remove());
            content.after(editor);
            editor.querySelector("textarea")?.focus();
            return;
        }

        const deletePostButton = target.closest("[data-post-delete]");
        if (deletePostButton) {
            const card = deletePostButton.closest("[data-post-card]");
            const postId = card?.dataset.localPostId;
            const post = readArray(storageKeys.posts).find((item) => item.id === postId);
            if (!card || !post || post.author !== currentUserName) return;
            if (!window.confirm("ต้องการลบโพสต์นี้หรือไม่?")) return;
            const posts = readArray(storageKeys.posts).filter((item) =>
                !(item.id === postId && item.author === currentUserName));
            const key = getPostKey(card);
            const nextComments = { ...savedComments };
            delete nextComments[key];
            if (!writeStorage(storageKeys.comments, nextComments)) return;
            if (!writeStorage(storageKeys.posts, posts)) {
                if (!writeStorage(storageKeys.comments, savedComments)) {
                    console.error("Could not restore post comments after its post could not be removed.");
                }
                return;
            }
            Object.keys(savedComments).forEach((commentKey) => delete savedComments[commentKey]);
            Object.assign(savedComments, nextComments);
            likedPosts.delete(key);
            savedPosts.delete(key);
            writeStorage(storageKeys.likes, [...likedPosts]);
            writeStorage(storageKeys.saved, [...savedPosts]);
            card.remove();
            filterPosts();
            window.dispatchEvent(new CustomEvent("learnlink:community-post-deleted", {
                detail: { postId, communityId: post.communityId },
            }));
            showToast("ลบโพสต์แล้ว");
            return;
        }

        const editCommentButton = target.closest("[data-comment-edit]");
        if (editCommentButton) {
            const card = editCommentButton.closest("[data-post-card]");
            const item = editCommentButton.closest(".comment-item");
            const key = card ? getPostKey(card) : "";
            const commentId = editCommentButton.dataset.commentEdit;
            const comments = normalizeComments(Array.isArray(savedComments[key]) ? savedComments[key] : []);
            const comment = comments.find((entry) => entry.id === commentId);
            if (!item || !comment || comment.author !== currentUserName) return;
            const content = item.querySelector(".comment-content");
            if (!content || item.querySelector(".inline-edit-form")) return;
            const editor = createInlineEditor(comment.content, (updatedContent) => {
                const latest = normalizeComments(Array.isArray(savedComments[key]) ? savedComments[key] : []);
                const index = latest.findIndex((entry) => entry.id === commentId && entry.author === currentUserName);
                if (index < 0) return;
                latest[index] = { ...latest[index], content: updatedContent, updatedAt: new Date().toISOString() };
                if (!writeStorage(storageKeys.comments, { ...savedComments, [key]: latest })) return;
                savedComments[key] = latest;
                updatePostControls(card);
                showToast("แก้ไขความคิดเห็นแล้ว");
            }, () => updatePostControls(card));
            content.after(editor);
            editor.querySelector("textarea")?.focus();
            return;
        }

        const deleteCommentButton = target.closest("[data-comment-delete]");
        if (deleteCommentButton) {
            const card = deleteCommentButton.closest("[data-post-card]");
            const key = card ? getPostKey(card) : "";
            const commentId = deleteCommentButton.dataset.commentDelete;
            const comments = normalizeComments(Array.isArray(savedComments[key]) ? savedComments[key] : []);
            const comment = comments.find((entry) => entry.id === commentId);
            if (!comment || comment.author !== currentUserName) return;
            if (!window.confirm("ต้องการลบความคิดเห็นนี้หรือไม่?")) return;
            const updated = comments.filter((entry) => entry.id !== commentId);
            if (!writeStorage(storageKeys.comments, { ...savedComments, [key]: updated })) return;
            savedComments[key] = updated;
            updatePostControls(card);
            showToast("ลบความคิดเห็นแล้ว");
            return;
        }

        const topicLink = target.closest("[data-topic-filter]");
        if (topicLink) {
            event.preventDefault();
            const topic = topicLink.dataset.topicFilter || "";
            if (searchInput) searchInput.value = `#${topic}`;
            activeQuery = `#${topic}`.toLocaleLowerCase();
            savedOnly = false;
            filterPosts();
            document.querySelector("#post-feed")?.scrollIntoView({ behavior: "smooth" });
            return;
        }

        const filterLink = target.closest("[data-feed-filter]");
        if (filterLink) {
            event.preventDefault();
            savedOnly = filterLink.dataset.feedFilter === "saved";
            document.querySelectorAll("[data-feed-filter]").forEach((link) => {
                link.classList.toggle("is-active", link === filterLink);
            });
            filterPosts();
            document.querySelector("#post-feed")?.scrollIntoView({ behavior: "smooth" });
            return;
        }

        const action = target.closest("[data-action]");
        if (!action) return;
        const name = action.dataset.action;
        const composer = action.closest("[data-composer]");
        const card = action.closest("[data-post-card]");

        if (name === "choose-image") {
            composer?.querySelector("[data-image-input]")?.click();
        } else if (name === "remove-image" && composer) {
            delete composer.dataset.image;
            composer.querySelector("[data-image-preview]").hidden = true;
            composer.querySelector("[data-image-input]").value = "";
        } else if (name === "like" && card) {
            const key = getPostKey(card);
            if (likedPosts.has(key)) likedPosts.delete(key);
            else likedPosts.add(key);
            writeStorage(storageKeys.likes, [...likedPosts]);
            updatePostControls(card);
        } else if (name === "save" && card) {
            const key = getPostKey(card);
            if (savedPosts.has(key)) savedPosts.delete(key);
            else savedPosts.add(key);
            writeStorage(storageKeys.saved, [...savedPosts]);
            updatePostControls(card);
            filterPosts();
            showToast(savedPosts.has(key) ? "บันทึกโพสต์แล้ว" : "นำโพสต์ออกจากรายการบันทึกแล้ว");
        } else if (name === "comment" && card) {
            showCommentForm(card);
        } else if (name === "share" && card) {
            const url = `${location.origin}${location.pathname}#post-${getPostKey(card)}`;
            if (navigator.share) {
                try {
                    await navigator.share({ title: "LearnLink", url });
                } catch (error) {
                    if (error.name !== "AbortError") {
                        console.error("Could not share this post.", error);
                        showToast("แชร์โพสต์ไม่สำเร็จ");
                    }
                }
            } else if (navigator.clipboard?.writeText) {
                try {
                    await navigator.clipboard.writeText(url);
                    showToast("คัดลอกลิงก์โพสต์แล้ว");
                } catch (error) {
                    console.error("Could not copy the post link.", error);
                    showToast("คัดลอกลิงก์ไม่สำเร็จ");
                }
            } else {
                showToast("เบราว์เซอร์นี้ไม่รองรับการแชร์ลิงก์");
            }
        } else if (name === "notifications") {
            showToast("ยังไม่มีการแจ้งเตือนใหม่");
        } else if (name === "profile") {
            showToast(`เข้าสู่ระบบในชื่อ ${document.body.dataset.currentUser || "ผู้เรียน LearnLink"}`);
        }
    });

    document.querySelectorAll("[data-post-kind]").forEach((button) => {
        button.addEventListener("click", () => {
            const form = button.closest("[data-composer]");
            const selected = button.getAttribute("aria-pressed") === "true";
            form.querySelectorAll("[data-post-kind]").forEach((option) => option.setAttribute("aria-pressed", "false"));
            if (selected) {
                delete form.dataset.postKind;
            } else {
                button.setAttribute("aria-pressed", "true");
                form.dataset.postKind = button.dataset.postKind;
            }
        });
    });

})();

(() => {
    const codeStorageKey = "learnlink.public-community-codes.v1";
    const createdStorageKey = "learnlink.created-communities.v1";
    const joinedStorageKey = "learnlink.communities.v1";
    const communityPostsStorageKey = "learnlink.community-posts.v1";
    const communityClearedPostsStorageKey = "learnlink.community-cleared-posts.v1";
    const communityCommentsStorageKey = "learnlink.comments.v1";
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const currentUserName = (
        document.body.dataset.currentUser
        || document.querySelector(".sidebar-profile-name")?.textContent
        || "ผู้เรียน LearnLink"
    ).trim();
    const codeFields = [...document.querySelectorAll("[data-community-code]")];
    const communityGrid = document.querySelector(".community-grid");
    const communityPage = document.querySelector(".communities-page");
    if (!communityPage || !communityGrid) return;

    const readStorage = (key, fallback) => {
        try {
            const value = localStorage.getItem(key);
            return value ? JSON.parse(value) : fallback;
        } catch (error) {
            console.error(`Could not read LearnLink community data (${key}).`, error);
            return fallback;
        }
    };

    const writeStorage = (key, value) => {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error(`Could not save LearnLink community data (${key}).`, error);
            return false;
        }
    };

    const readArray = (key) => {
        const value = readStorage(key, []);
        return Array.isArray(value) ? value : [];
    };

    const createInviteCode = (existingCodes = []) => {
        if (!window.crypto?.getRandomValues) {
            throw new Error("Secure random code generation is unavailable.");
        }
        const occupied = new Set(existingCodes.map((code) => code.toLocaleUpperCase()));
        for (let attempt = 0; attempt < 10; attempt += 1) {
            const values = window.crypto.getRandomValues(new Uint8Array(8));
            const code = Array.from(values, (value) => alphabet[value % alphabet.length]).join("");
            if (!occupied.has(code)) return `LL-${code}`;
        }
        throw new Error("Could not generate a unique community code.");
    };

    const sampleCommunityPosts = {
        python: [
            { author: "นนท์", content: "มีใครแนะนำโปรเจกต์ Python สำหรับฝึกมือใหม่บ้างครับ?", ageHours: 6 },
            { author: "มินตรา", content: "ลองเริ่มจากทำ to-do list แล้วค่อยต่อยอดเป็นเว็บเล็ก ๆ ดูนะคะ", ageHours: 12 },
        ],
        ux: [
            { author: "พลอย", content: "แชร์ checklist เล็ก ๆ ก่อนส่งงานออกแบบค่ะ ✨", ageHours: 4 },
            { author: "ออม", content: "มีแหล่งเรียนรู้เรื่อง accessibility แนะนำไหมคะ?", ageHours: 10 },
        ],
        english: [
            { author: "พลอย", content: "วันนี้ลองเขียน journal ภาษาอังกฤษ 3 บรรทัดแล้วค่ะ", ageHours: 3 },
            { author: "นนท์", content: "ฝึกวันละนิด เก่งขึ้นแน่นอนครับ", ageHours: 9 },
        ],
    };

    const matchesCommunity = (community, source) => {
        const text = source.toLocaleLowerCase();
        if (text.includes(community.name.toLocaleLowerCase())) return true;
        const aliases = {
            python: ["python"],
            ux: ["uxdesign", "ux/ui"],
            english: ["english", "ภาษาอังกฤษ"],
        }[community.id] || [];
        return aliases.some((alias) => text.includes(alias));
    };

    const createdCommunities = readStorage(createdStorageKey, []);
    const safeCreatedCommunities = Array.isArray(createdCommunities)
        ? createdCommunities.filter((community) =>
            community
            && typeof community.name === "string"
            && typeof community.code === "string"
            && typeof community.visibility === "string"
            && typeof community.id === "string")
            .map((community) => ({
                ...community,
                description: typeof community.description === "string" ? community.description : "",
                image: typeof community.image === "string" ? community.image : "",
                owner: typeof community.owner === "string" && community.owner.trim()
                    ? community.owner.trim()
                    : currentUserName,
                members: [...new Set([
                    ...(Array.isArray(community.members)
                        ? community.members.filter((member) => typeof member === "string" && member.trim())
                        : []),
                    typeof community.owner === "string" && community.owner.trim()
                        ? community.owner.trim()
                        : currentUserName,
                ])],
            }))
        : [];
    const storedCodes = readStorage(codeStorageKey, {});
    const communityCodes = storedCodes && typeof storedCodes === "object" && !Array.isArray(storedCodes)
        ? storedCodes
        : {};

    const allCodes = () => [
        ...Object.values(communityCodes).filter((code) => typeof code === "string"),
        ...safeCreatedCommunities.map((community) => community.code),
    ].filter((code) => typeof code === "string");

    let codesChanged = false;
    codeFields.forEach((field) => {
        const name = field.dataset.communityCode;
        if (!communityCodes[name]) {
            communityCodes[name] = createInviteCode(allCodes());
            codesChanged = true;
        }
        field.textContent = communityCodes[name];
    });
    if (codesChanged && !writeStorage(codeStorageKey, communityCodes)) {
        console.error("Public community codes could not be saved; they may change on this browser.");
    }

    const joinedValue = readStorage(joinedStorageKey, []);
    const joinedCommunities = new Set(Array.isArray(joinedValue) ? joinedValue : []);
    safeCreatedCommunities.forEach((community) => {
        if (community.owner === currentUserName) {
            joinedCommunities.add(community.name);
        } else if (!community.members.some((member) => member.toLocaleLowerCase() === currentUserName.toLocaleLowerCase())) {
            joinedCommunities.delete(community.name);
        }
    });
    if (!writeStorage(joinedStorageKey, [...joinedCommunities])) {
        console.error("Could not persist membership for locally created communities.");
    }
    const joinedCommunityList = document.querySelector("[data-joined-community-list]");
    const joinedCommunityEmpty = document.querySelector("[data-joined-community-empty]");
    const composerPicker = document.querySelector("[data-composer-community-picker]");
    const composerPickerOptions = composerPicker?.querySelector("[data-composer-community-options]");
    const composerPickerSearch = composerPicker?.querySelector("[data-composer-community-search]");
    const composerPickerEmpty = composerPicker?.querySelector("[data-composer-community-empty]");

    const renderComposerCommunityOptions = () => {
        if (!composerPickerOptions) return;
        const query = (composerPickerSearch?.value || "").trim().toLocaleLowerCase();
        const communities = [...joinedCommunities]
            .map((name) => {
                const detail = [...document.querySelectorAll("[data-community-detail][data-community-name]")]
                    .find((item) => item.dataset.communityName === name);
                return detail ? { id: detail.dataset.communityId, name, detail } : null;
            })
            .filter((community) => community && community.id)
            .filter((community) => community.name.toLocaleLowerCase().includes(query));
        composerPickerOptions.replaceChildren();
        communities.forEach((community) => {
            const item = document.createElement("li");
            const button = document.createElement("button");
            button.type = "button";
            button.dataset.communitySelectForPost = "";
            button.dataset.communityId = community.id;
            button.dataset.communityName = community.name;
            button.textContent = community.name;
            item.append(button);
            composerPickerOptions.append(item);
        });
        if (composerPickerEmpty) {
            composerPickerEmpty.hidden = communities.length > 0;
            composerPickerEmpty.textContent = joinedCommunities.size
                ? "ไม่พบชุมชนที่ตรงกับคำค้นหา"
                : "เข้าร่วมชุมชนก่อน จึงจะเลือกโพสต์ได้";
        }
    };

    const renderJoinedCommunityList = () => {
        if (!joinedCommunityList) return;

        joinedCommunityList.replaceChildren();
        const names = [...joinedCommunities].sort((first, second) => first.localeCompare(second, "th"));
        names.forEach((name) => {
            const detail = [...document.querySelectorAll("[data-community-detail][data-community-name]")]
                .find((item) => item.dataset.communityName === name);
            const communityMark = detail?.querySelector(".community-mark");
            const item = document.createElement("li");
            const link = document.createElement("a");
            link.href = detail?.id ? `#${detail.id}` : "#communities-page";
            link.title = name;
            const mark = document.createElement("span");
            mark.className = "joined-community-mark";
            mark.textContent = communityMark?.textContent.trim() || name.slice(0, 2).toUpperCase();
            const label = document.createElement("span");
            label.textContent = name;
            link.append(mark, label);
            item.append(link);
            joinedCommunityList.append(item);
        });
        if (joinedCommunityEmpty) joinedCommunityEmpty.hidden = names.length > 0;
        renderComposerCommunityOptions();
    };
    const updateJoinButtons = () => {
        document.querySelectorAll("[data-community-detail][data-community-id]").forEach((detail) => {
            const community = safeCreatedCommunities.find((item) => item.id === detail.dataset.communityId);
            if (!community) return;
            const isOwner = community.owner === currentUserName;
            detail.dataset.communityOwner = String(isOwner);
            const ownerActions = detail.querySelector("[data-community-owner-actions]");
            if (ownerActions) ownerActions.hidden = !isOwner;
            const memberSelect = detail.querySelector("[data-community-member-select]");
            if (memberSelect) {
                const previousValue = memberSelect.value;
                const removableMembers = community.members.filter((member) =>
                    member.toLocaleLowerCase() !== community.owner.toLocaleLowerCase());
                memberSelect.replaceChildren();
                const placeholder = document.createElement("option");
                placeholder.value = "";
                placeholder.textContent = removableMembers.length ? "เลือกสมาชิก" : "ยังไม่มีสมาชิกคนอื่น";
                placeholder.disabled = true;
                placeholder.selected = true;
                memberSelect.append(placeholder);
                removableMembers.forEach((member) => {
                    const option = document.createElement("option");
                    option.value = member;
                    option.textContent = member;
                    memberSelect.append(option);
                });
                if (removableMembers.includes(previousValue)) memberSelect.value = previousValue;
                memberSelect.disabled = removableMembers.length === 0;
                const removeButton = detail.querySelector("[data-community-member-remove]");
                if (removeButton) removeButton.disabled = removableMembers.length === 0;
            }
        });
        document.querySelectorAll("[data-community-join]").forEach((button) => {
            const detail = button.closest("[data-community-detail]");
            const isOwner = detail?.dataset.communityOwner === "true";
            const joined = isOwner || joinedCommunities.has(button.dataset.communityJoin);
            button.setAttribute("aria-pressed", String(joined));
            button.disabled = isOwner;
            button.classList.toggle("button-danger", joined && !isOwner);
            button.classList.toggle("button-primary", !joined);
            button.classList.toggle("button-secondary", isOwner);
            button.textContent = isOwner
                ? "เจ้าของชุมชน"
                : joined
                    ? "ออกจากชุมชน"
                    : "เข้าร่วมชุมชน";
        });
        document.querySelectorAll("[data-community-members-only]").forEach((area) => {
            const detail = area.closest("[data-community-detail]");
            const communityName = detail?.dataset.communityName;
            const isOwner = detail?.dataset.communityOwner === "true";
            area.hidden = !isOwner && !joinedCommunities.has(communityName);
        });
        document.querySelectorAll("[data-community-post-wall]").forEach((wall) => {
            const detail = wall.closest("[data-community-detail]");
            const communityName = detail?.dataset.communityName;
            const isPublic = detail?.dataset.communityVisibility !== "private";
            wall.hidden = !isPublic && !joinedCommunities.has(communityName);
        });
        renderJoinedCommunityList();
    };

    const showMessage = (element, text, isError = false) => {
        if (!element) return;
        element.textContent = text;
        element.dataset.state = isError ? "error" : "success";
        element.hidden = false;
    };

    let communityToastTimer;
    const showCommunityToast = (message) => {
        let toast = document.querySelector("[data-toast]");
        if (!toast) {
            toast = document.createElement("div");
            toast.className = "toast-message";
            toast.dataset.toast = "";
            toast.setAttribute("role", "status");
            toast.setAttribute("aria-live", "polite");
            document.body.append(toast);
        }
        toast.textContent = message;
        toast.classList.add("is-visible");
        window.clearTimeout(communityToastTimer);
        communityToastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 2600);
    };

    const setCommunityMark = (mark, name, image) => {
        if (!mark) return;
        mark.replaceChildren();
        if (image) {
            const picture = document.createElement("img");
            picture.src = image;
            picture.alt = name;
            mark.append(picture);
        } else {
            mark.textContent = name.slice(0, 2).toUpperCase();
        }
    };

    const normalizeCommunityComments = (comments) => comments.map((comment, index) => {
        if (typeof comment === "string") {
            return {
                id: `legacy-${index}`,
                author: currentUserName,
                content: comment,
            };
        }
        if (!comment || typeof comment.content !== "string") return null;
        return {
            id: typeof comment.id === "string" ? comment.id : `legacy-${index}`,
            author: typeof comment.author === "string" ? comment.author : currentUserName,
            content: comment.content,
        };
    }).filter(Boolean);

    const communityCommentKey = (postId) => `community-${postId}`;

    const createCommunityInlineEditor = (value, onSave, onCancel) => {
        const form = document.createElement("form");
        form.className = "inline-edit-form";
        const input = document.createElement("textarea");
        input.className = "inline-edit-input";
        input.rows = 3;
        input.value = value;
        input.required = true;
        const actions = document.createElement("div");
        actions.className = "inline-edit-actions";
        const save = document.createElement("button");
        save.className = "button-primary";
        save.type = "submit";
        save.textContent = "บันทึก";
        const cancel = document.createElement("button");
        cancel.className = "button-secondary";
        cancel.type = "button";
        cancel.textContent = "ยกเลิก";
        cancel.addEventListener("click", onCancel);
        actions.append(save, cancel);
        form.append(input, actions);
        form.addEventListener("submit", (event) => {
            event.preventDefault();
            const content = input.value.trim();
            if (content) onSave(content);
        });
        return form;
    };

    const renderCommunityPost = (post) => {
        const article = document.createElement("article");
        article.className = "card community-post-card";
        if (post.id) article.dataset.communityPostId = post.id;
        article.dataset.postSource = post.storageType || "";
        const heading = document.createElement("div");
        heading.className = "community-post-author";
        const author = document.createElement("strong");
        author.textContent = post.author;
        const date = document.createElement("time");
        date.dateTime = post.createdAt;
        date.textContent = new Date(post.createdAt).toLocaleString("th-TH");
        heading.append(author, date);
        if (post.id && post.author === currentUserName) {
            const controls = document.createElement("div");
            controls.className = "community-post-owner-actions";
            const edit = document.createElement("button");
            edit.type = "button";
            edit.dataset.communityPostEdit = "";
            edit.textContent = "แก้ไข";
            const remove = document.createElement("button");
            remove.type = "button";
            remove.dataset.communityPostDelete = "";
            remove.textContent = "ลบ";
            controls.append(edit, remove);
            heading.append(controls);
        }
        const content = document.createElement("p");
        content.className = "community-post-content";
        content.textContent = post.content;
        article.append(heading, content);
        if (post.image) {
            const image = document.createElement("img");
            image.className = "community-post-image";
            image.src = post.image;
            image.alt = "ภาพประกอบโพสต์";
            image.loading = "lazy";
            article.append(image);
        }
        if (!post.id) return article;
        const commentArea = document.createElement("section");
        commentArea.className = "community-comment-area";
        const allComments = readStorage(communityCommentsStorageKey, {});
        const postComments = allComments && typeof allComments === "object"
            ? allComments[communityCommentKey(post.id)]
            : [];
        const comments = normalizeCommunityComments(Array.isArray(postComments) ? postComments : []);
        const commentList = document.createElement("div");
        commentList.className = "community-comment-list";
        comments.forEach((comment) => {
            const item = document.createElement("div");
            item.className = "community-comment-item";
            item.dataset.communityCommentId = comment.id;
            const text = document.createElement("p");
            const commenter = document.createElement("strong");
            commenter.textContent = comment.author;
            text.append(commenter, document.createTextNode(` ${comment.content}`));
            item.append(text);
            if (comment.author === currentUserName) {
                const controls = document.createElement("div");
                controls.className = "community-post-owner-actions";
                const edit = document.createElement("button");
                edit.type = "button";
                edit.dataset.communityCommentEdit = "";
                edit.textContent = "แก้ไข";
                const remove = document.createElement("button");
                remove.type = "button";
                remove.dataset.communityCommentDelete = "";
                remove.textContent = "ลบ";
                controls.append(edit, remove);
                item.append(controls);
            }
            commentList.append(item);
        });
        const commentForm = document.createElement("form");
        commentForm.className = "community-comment-form";
        commentForm.dataset.communityCommentForm = "";
        const commentInput = document.createElement("input");
        commentInput.name = "content";
        commentInput.type = "text";
        commentInput.placeholder = "เขียนความคิดเห็น...";
        commentInput.required = true;
        const commentSubmit = document.createElement("button");
        commentSubmit.type = "submit";
        commentSubmit.className = "button-secondary";
        commentSubmit.textContent = "ส่ง";
        commentForm.append(commentInput, commentSubmit);
        commentArea.append(commentList, commentForm);
        article.append(commentArea);
        return article;
    };

    const renderCommunityPosts = () => {
        const clearedIds = new Set(readArray(communityClearedPostsStorageKey));
        const storedPosts = readArray(communityPostsStorageKey).filter((post) =>
            post
            && typeof post.communityId === "string"
            && typeof post.author === "string"
            && typeof post.content === "string"
            && typeof post.createdAt === "string"
            && !Number.isNaN(Date.parse(post.createdAt)));
        const feedPosts = readArray("learnlink.posts.v1").filter((post) =>
            post
            && typeof post.author === "string"
            && typeof post.content === "string"
            && typeof post.createdAt === "string"
            && !Number.isNaN(Date.parse(post.createdAt)));
        document.querySelectorAll("[data-community-posts]").forEach((list) => {
            const detail = list.closest("[data-community-detail]");
            const communityId = detail?.dataset.communityId;
            const community = {
                id: communityId || "",
                name: detail?.dataset.communityName || "",
            };
            const samples = (sampleCommunityPosts[communityId] || []).map((post) => ({
                ...post,
                communityId,
                createdAt: new Date(Date.now() - post.ageHours * 60 * 60 * 1000).toISOString(),
            })).filter(() => !clearedIds.has(communityId));
            const localFeedPosts = feedPosts
                .filter((post) => post.communityId
                    ? post.communityId === communityId
                    : matchesCommunity(community, `${post.kind || ""} ${post.content}`))
                .map((post) => ({ ...post, communityId, storageType: "feed" }));
            const visibleStaticPosts = clearedIds.has(communityId) ? [] : [...document.querySelectorAll(".feed-page .feed-list .post-card")]
                .map((card, index) => {
                    const author = card.querySelector(".post-author strong")?.textContent.trim() || "ผู้เรียน LearnLink";
                    const content = card.querySelector(".post-content")?.textContent.trim() || "";
                    const communityLabel = `${card.querySelector(".post-meta")?.textContent || ""} ${card.querySelector(".post-community")?.textContent || ""}`;
                    if (!content || !matchesCommunity(community, `${communityLabel} ${content}`)) return null;
                    return {
                        communityId,
                        author,
                        content,
                        image: card.querySelector(".post-image")?.src || "",
                        createdAt: new Date(Date.now() - (index + 1) * 60 * 60 * 1000).toISOString(),
                    };
                })
                .filter(Boolean);
            const posts = [
                ...samples,
                ...visibleStaticPosts,
                ...localFeedPosts,
                ...storedPosts.filter((post) => post.communityId === communityId)
                    .map((post) => ({ ...post, storageType: "community" })),
            ].filter((post, index, allPosts) =>
                allPosts.findIndex((candidate) => candidate.content === post.content) === index)
                .sort((first, second) => second.createdAt.localeCompare(first.createdAt));
            list.replaceChildren(
                ...posts.map(renderCommunityPost),
            );
            const empty = detail?.querySelector("[data-community-post-empty]");
            if (empty) empty.hidden = posts.length > 0;
        });
    };

    const renderCommunityPostForm = (community) => {
        const section = document.createElement("section");
        section.className = "community-member-area";
        section.dataset.communityMembersOnly = "";
        const heading = document.createElement("h3");
        heading.textContent = "แบ่งปันในชุมชนนี้";
        const form = document.createElement("form");
        form.className = "community-post-form";
        form.dataset.communityPostForm = "";
        const label = document.createElement("label");
        label.textContent = "เขียนโพสต์";
        const inputId = `community-post-${community.id}`;
        label.htmlFor = inputId;
        const textarea = document.createElement("textarea");
        textarea.id = inputId;
        textarea.name = "content";
        textarea.rows = 3;
        textarea.placeholder = "แบ่งปันสิ่งที่กำลังเรียนรู้กับชุมชนนี้...";
        textarea.required = true;
        const controls = document.createElement("div");
        controls.className = "community-post-controls";
        const imageId = `${inputId}-image`;
        const imageLabel = document.createElement("label");
        imageLabel.className = "button-secondary community-image-picker";
        imageLabel.htmlFor = imageId;
        imageLabel.textContent = "▧ เพิ่มรูป";
        const imageInput = document.createElement("input");
        imageInput.className = "file-input-hidden";
        imageInput.id = imageId;
        imageInput.type = "file";
        imageInput.accept = "image/*";
        imageInput.dataset.communityPostImage = "";
        const submit = document.createElement("button");
        submit.className = "button-primary";
        submit.type = "submit";
        submit.textContent = "โพสต์ในชุมชน";
        controls.append(imageLabel, imageInput, submit);
        const preview = document.createElement("img");
        preview.className = "community-post-image-preview";
        preview.dataset.communityPostPreview = "";
        preview.alt = "ตัวอย่างรูปโพสต์";
        preview.hidden = true;
        const message = document.createElement("p");
        message.className = "community-form-message";
        message.dataset.postMessage = "";
        message.setAttribute("role", "status");
        message.hidden = true;
        form.append(label, textarea, controls, preview, message);
        section.append(heading, form);
        return section;
    };

    const renderCommunityEditor = (community) => {
        const details = document.createElement("details");
        details.className = "community-edit-details";
        const summary = document.createElement("summary");
        summary.className = "community-settings-item";
        summary.textContent = "แก้ไขชุมชน";
        const form = document.createElement("form");
        form.className = "community-edit-form";
        form.dataset.communityEditForm = "";
        const nameLabel = document.createElement("label");
        const nameId = `edit-community-name-${community.id}`;
        nameLabel.htmlFor = nameId;
        nameLabel.textContent = "ชื่อชุมชน";
        const nameInput = document.createElement("input");
        nameInput.id = nameId;
        nameInput.name = "name";
        nameInput.value = community.name;
        nameInput.required = true;
        const descriptionLabel = document.createElement("label");
        const descriptionId = `edit-community-description-${community.id}`;
        descriptionLabel.htmlFor = descriptionId;
        descriptionLabel.textContent = "รายละเอียดชุมชน";
        const descriptionInput = document.createElement("textarea");
        descriptionInput.id = descriptionId;
        descriptionInput.name = "description";
        descriptionInput.rows = 3;
        descriptionInput.value = community.description;
        const imageId = `edit-community-image-${community.id}`;
        const imagePicker = document.createElement("label");
        imagePicker.className = "button-secondary community-image-picker";
        imagePicker.htmlFor = imageId;
        imagePicker.textContent = "▧ เปลี่ยนรูปชุมชน";
        const imageInput = document.createElement("input");
        imageInput.className = "file-input-hidden";
        imageInput.id = imageId;
        imageInput.type = "file";
        imageInput.accept = "image/*";
        imageInput.dataset.communityImageInput = "";
        const preview = document.createElement("img");
        preview.className = "community-image-preview";
        preview.dataset.communityImagePreview = "";
        preview.alt = "ตัวอย่างรูปชุมชน";
        if (community.image) {
            preview.src = community.image;
            preview.hidden = false;
            form.dataset.communityImage = community.image;
        } else {
            preview.hidden = true;
        }
        const save = document.createElement("button");
        save.className = "button-primary";
        save.type = "submit";
        save.textContent = "บันทึกการแก้ไข";
        const message = document.createElement("p");
        message.className = "community-form-message";
        message.dataset.editMessage = "";
        message.setAttribute("role", "status");
        message.hidden = true;
        form.append(nameLabel, nameInput, descriptionLabel, descriptionInput, imagePicker, imageInput, preview, save, message);
        details.append(summary, form);
        return details;
    };

    const renderCommunityOwnerActions = (community, editor) => {
        const actions = document.createElement("div");
        actions.className = "community-owner-actions";
        actions.dataset.communityOwnerActions = "";
        actions.hidden = community.owner !== currentUserName;

        const settings = document.createElement("details");
        settings.className = "community-settings-menu";
        const settingsButton = document.createElement("summary");
        settingsButton.className = "community-settings-trigger";
        settingsButton.setAttribute("aria-label", "ตั้งค่าชุมชน");
        settingsButton.title = "ตั้งค่าชุมชน";
        const settingsIcon = document.createElement("span");
        settingsIcon.className = "material-symbols-rounded";
        settingsIcon.textContent = "settings";
        settingsButton.append(settingsIcon);
        const menu = document.createElement("div");
        menu.className = "community-settings-dropdown";
        menu.setAttribute("aria-label", "เมนูจัดการชุมชน");

        const transferDetails = document.createElement("details");
        transferDetails.className = "community-owner-transfer";
        const summary = document.createElement("summary");
        summary.className = "community-settings-item";
        summary.textContent = "โอนความเป็นเจ้าของ";
        const form = document.createElement("form");
        form.className = "community-transfer-form";
        form.dataset.communityTransferForm = "";
        const label = document.createElement("label");
        const inputId = `new-owner-${community.id}`;
        label.htmlFor = inputId;
        label.textContent = "ชื่อสมาชิกที่จะรับช่วงเป็นเจ้าของ";
        const input = document.createElement("input");
        input.id = inputId;
        input.name = "newOwner";
        input.type = "text";
        input.placeholder = "กรอกชื่อสมาชิก";
        input.required = true;
        const help = document.createElement("small");
        help.textContent = "การโอนจะทำให้คุณออกจากชุมชนทันที";
        const transfer = document.createElement("button");
        transfer.className = "button-primary";
        transfer.type = "submit";
        transfer.textContent = "โอนสิทธิ์และออกจากชุมชน";
        form.append(label, input, help, transfer);
        transferDetails.append(summary, form);

        const membersDetails = document.createElement("details");
        membersDetails.className = "community-owner-members";
        const membersSummary = document.createElement("summary");
        membersSummary.className = "community-settings-item";
        membersSummary.textContent = "จัดการสมาชิก";
        const membersForm = document.createElement("form");
        membersForm.className = "community-member-manager";
        membersForm.dataset.communityMemberRemoveForm = "";
        const membersLabel = document.createElement("label");
        const membersSelectId = `community-member-${community.id}`;
        membersLabel.htmlFor = membersSelectId;
        membersLabel.textContent = "เลือกสมาชิกที่ต้องการนำออก";
        const membersSelect = document.createElement("select");
        membersSelect.id = membersSelectId;
        membersSelect.name = "member";
        membersSelect.dataset.communityMemberSelect = "";
        const removeMember = document.createElement("button");
        removeMember.className = "button-danger";
        removeMember.type = "submit";
        removeMember.dataset.communityMemberRemove = "";
        removeMember.textContent = "นำสมาชิกออก";
        membersForm.append(membersLabel, membersSelect, removeMember);
        membersDetails.append(membersSummary, membersForm);

        const clearPosts = document.createElement("button");
        clearPosts.className = "community-settings-item-danger";
        clearPosts.type = "button";
        clearPosts.dataset.communityClearPosts = "";
        clearPosts.textContent = "ลบโพสต์ทั้งหมดในชุมชน";

        const remove = document.createElement("button");
        remove.className = "button-danger community-delete-button";
        remove.type = "button";
        remove.dataset.communityDelete = "";
        remove.textContent = "ลบชุมชน";
        remove.classList.add("community-settings-item-danger");

        menu.append(editor, membersDetails, transferDetails, clearPosts, remove);
        settings.append(settingsButton, menu);
        actions.append(settings);
        return actions;
    };

    const renderCreatedCommunity = (community) => {
        const detailId = `created-community-${community.id}`;
        if (community.visibility === "public" && !document.getElementById(detailId)) {
            const card = document.createElement("article");
            card.className = "card community-card";
            card.dataset.communityCard = "";
            card.dataset.communityId = community.id;
            card.dataset.communityName = community.name;
            card.dataset.communityPublic = "true";
            const cardMark = document.createElement("span");
            cardMark.className = "community-mark";
            setCommunityMark(cardMark, community.name, community.image);
            const heading = document.createElement("h3");
            heading.textContent = community.name;
            const description = document.createElement("p");
            description.textContent = community.description;
            const members = document.createElement("span");
            members.className = "community-count";
            members.textContent = "ชุมชนใหม่";
            const link = document.createElement("a");
            link.className = "button-secondary";
            link.href = `#${detailId}`;
            link.textContent = "ดูชุมชน";
            card.append(cardMark, heading, description, members, link);
            communityGrid.append(card);
        }

        if (document.getElementById(detailId)) return;
        const detail = document.createElement("section");
        detail.className = "card community-detail-preview";
        detail.id = detailId;
        detail.dataset.communityDetail = "";
        detail.dataset.communityId = community.id;
        detail.dataset.communityVisibility = community.visibility;
        detail.dataset.communityName = community.name;
        detail.dataset.communityOwner = String(community.owner === currentUserName);

        const top = document.createElement("div");
        top.className = "community-detail-top";
        const topMark = document.createElement("span");
        topMark.className = "community-mark";
        setCommunityMark(topMark, community.name, community.image);
        const info = document.createElement("div");
        const type = document.createElement("span");
        type.className = "eyebrow";
        type.textContent = community.visibility === "public" ? "COMMUNITY · สาธารณะ" : "COMMUNITY · ส่วนตัว";
        const title = document.createElement("h2");
        title.textContent = community.name;
        const description = document.createElement("p");
        description.textContent = community.description;
        const joinButton = document.createElement("button");
        joinButton.className = "button-primary";
        joinButton.type = "button";
        joinButton.dataset.communityJoin = community.name;
        const editor = renderCommunityEditor(community);
        const ownerActions = renderCommunityOwnerActions(community, editor);
        info.append(type, title, description);
        top.append(topMark, info, joinButton, ownerActions);

        const code = document.createElement("p");
        code.className = "community-invite-code";
        code.append(document.createTextNode("รหัสเข้าร่วม: "));
        const codeValue = document.createElement("code");
        codeValue.textContent = community.code;
        code.append(codeValue);
        const ownerMessage = document.createElement("p");
        ownerMessage.className = "community-form-message";
        ownerMessage.dataset.ownerMessage = "";
        ownerMessage.setAttribute("role", "status");
        ownerMessage.hidden = true;
        const members = renderCommunityPostForm(community);
        const back = document.createElement("a");
        back.className = "button-secondary community-back-link";
        back.href = "#communities-page";
        back.textContent = "← กลับไปชุมชนทั้งหมด";
        const wall = document.createElement("section");
        wall.className = "community-post-wall";
        wall.dataset.communityPostWall = "";
        const wallHeading = document.createElement("h3");
        wallHeading.textContent = "โพสต์ทั้งหมด";
        const empty = document.createElement("p");
        empty.className = "community-post-empty";
        empty.dataset.communityPostEmpty = "";
        empty.textContent = "ยังไม่มีโพสต์ในชุมชนนี้";
        empty.hidden = true;
        const list = document.createElement("div");
        list.className = "community-post-list";
        list.dataset.communityPosts = "";
        wall.append(wallHeading, empty, list);
        detail.append(back, top, code, ownerMessage, members, wall);
        communityPage.insertBefore(detail, document.querySelector("[data-community-create]"));
    };

    safeCreatedCommunities.forEach(renderCreatedCommunity);
    updateJoinButtons();
    renderCommunityPosts();
    window.addEventListener("learnlink:community-post-created", renderCommunityPosts);
    composerPickerSearch?.addEventListener("input", renderComposerCommunityOptions);
    composerPickerOptions?.addEventListener("click", (event) => {
        const button = event.target instanceof Element
            ? event.target.closest("[data-community-select-for-post]")
            : null;
        if (!button) return;
        const composer = document.querySelector("[data-composer]");
        if (!composer) return;
        composer.dataset.communityId = button.dataset.communityId;
        composer.dataset.communityName = button.dataset.communityName;
        delete composer.dataset.postKind;
        const label = composerPicker.querySelector("[data-composer-community-label]");
        if (label) label.textContent = `◎ ${button.dataset.communityName}`;
        composerPicker.open = false;
        composerPickerSearch.value = "";
    });

    const searchInput = document.querySelector("[data-search-input], .prototype-topbar .search input");
    const emptyState = document.querySelector("[data-community-empty]");
    const filterCommunities = () => {
        const query = (searchInput?.value || "").trim().toLocaleLowerCase();
        let visibleCount = 0;
        document.querySelectorAll("[data-community-card]").forEach((card) => {
            const isPublic = card.dataset.communityPublic !== "false";
            const searchText = `${card.dataset.communityName || ""} ${card.textContent}`.toLocaleLowerCase();
            const visible = isPublic && (!query || searchText.includes(query));
            card.hidden = !visible;
            if (visible) visibleCount += 1;
        });
        if (emptyState) emptyState.hidden = !query || visibleCount > 0;
    };
    searchInput?.addEventListener("input", filterCommunities);
    filterCommunities();

    const publicCodeField = document.querySelector("[data-generated-community-code]");
    const privateCodeField = document.querySelector("#new-community-code");
    const createForm = document.querySelector("[data-community-create]");
    const createMessage = createForm?.querySelector("[data-create-message]");
    const visibilityInputs = [...(createForm?.querySelectorAll('[name="community-visibility"]') || [])];
    const isPublicSelection = () => createForm?.querySelector('[name="community-visibility"]:checked')?.value === "public";

    const refreshCreateCode = () => {
        if (!publicCodeField) return;
        try {
            publicCodeField.value = createInviteCode(allCodes());
        } catch (error) {
            console.error("Could not generate a public community code.", error);
            showMessage(createMessage, "สุ่มรหัสชุมชนไม่สำเร็จ กรุณาลองใหม่", true);
        }
    };
    refreshCreateCode();

    visibilityInputs.forEach((input) => {
        input.addEventListener("change", () => {
            if (privateCodeField) privateCodeField.required = input.value === "private";
            if (input.value === "public") refreshCreateCode();
        });
    });
    if (privateCodeField) {
        privateCodeField.required = !isPublicSelection();
    }

    document.querySelector("[data-regenerate-community-code]")?.addEventListener("click", refreshCreateCode);

    document.addEventListener("change", (event) => {
        const input = event.target instanceof HTMLInputElement ? event.target : null;
        if (!input || (!input.matches("[data-community-image-input]") && !input.matches("[data-community-post-image]"))) return;

        const file = input.files?.[0];
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            showMessage(input.closest("form")?.querySelector("[data-edit-message], [data-create-message], [data-post-message]"), "กรุณาเลือกไฟล์รูปภาพ", true);
            input.value = "";
            return;
        }
        if (file.size > 1024 * 1024) {
            showMessage(input.closest("form")?.querySelector("[data-edit-message], [data-create-message], [data-post-message]"), "รูปภาพต้องมีขนาดไม่เกิน 1 MB", true);
            input.value = "";
            return;
        }
        const reader = new FileReader();
        reader.addEventListener("load", () => {
            if (typeof reader.result !== "string") return;
            const form = input.closest("form");
            if (!form) return;
            if (input.matches("[data-community-post-image]")) {
                form.dataset.postImage = reader.result;
                const preview = form.querySelector("[data-community-post-preview]");
                if (preview) {
                    preview.src = reader.result;
                    preview.hidden = false;
                }
                return;
            }
            form.dataset.communityImage = reader.result;
            const preview = form.querySelector("[data-community-image-preview]");
            if (preview) {
                preview.src = reader.result;
                preview.hidden = false;
            }
        });
        reader.addEventListener("error", () => {
            console.error("Could not read the selected community image.");
            showMessage(input.closest("form")?.querySelector("[data-edit-message], [data-create-message], [data-post-message]"), "อ่านรูปภาพไม่สำเร็จ กรุณาลองใหม่", true);
        });
        reader.readAsDataURL(file);
    });

    createForm?.addEventListener("submit", (event) => {
        event.preventDefault();
        if (createMessage) {
            createMessage.hidden = true;
            delete createMessage.dataset.state;
        }
        if (!createForm.reportValidity()) return;

        const name = createForm.elements.namedItem("name").value.trim();
        const description = createForm.elements.namedItem("description").value.trim();
        const visibility = isPublicSelection() ? "public" : "private";
        const code = visibility === "public" ? publicCodeField.value : privateCodeField.value.trim();
        if (!code) {
            showMessage(createMessage, "ไม่มีรหัสเข้าร่วม กรุณาสุ่มรหัสใหม่แล้วลองอีกครั้ง", true);
            return;
        }
        if (allCodes().some((existingCode) => existingCode.toLocaleUpperCase() === code.toLocaleUpperCase())) {
            showMessage(createMessage, "รหัสนี้ถูกใช้งานแล้ว กรุณาสุ่มหรือตั้งรหัสใหม่", true);
            return;
        }
        const duplicateName = [
            ...document.querySelectorAll("[data-community-name]"),
            ...safeCreatedCommunities.map((community) => ({ dataset: { communityName: community.name } })),
        ].some((element) => element.dataset.communityName?.toLocaleLowerCase() === name.toLocaleLowerCase());
        if (duplicateName) {
            showMessage(createMessage, "มีชุมชนชื่อนี้อยู่แล้ว กรุณาใช้ชื่ออื่น", true);
            return;
        }

        const community = {
            id: code.replace(/[^a-zA-Z0-9]/g, "").toLocaleLowerCase(),
            name,
            description,
            visibility,
            code,
            image: createForm.dataset.communityImage || "",
            owner: currentUserName,
            members: [currentUserName],
        };
        const updatedCommunities = [...safeCreatedCommunities, community];
        if (!writeStorage(createdStorageKey, updatedCommunities)) {
            showMessage(createMessage, "บันทึกชุมชนในเบราว์เซอร์ไม่สำเร็จ", true);
            return;
        }
        safeCreatedCommunities.push(community);
        joinedCommunities.add(name);
        if (!writeStorage(joinedStorageKey, [...joinedCommunities])) {
            showMessage(createMessage, "สร้างชุมชนแล้ว แต่บันทึกการเข้าร่วมในเบราว์เซอร์ไม่สำเร็จ", true);
        }
        renderCreatedCommunity(community);
        updateJoinButtons();
        renderCommunityPosts();
        if (visibility === "public") {
            filterCommunities();
        }
        if (!createMessage?.dataset.state || createMessage.dataset.state !== "error") {
            showMessage(
                createMessage,
                visibility === "public"
                    ? `สร้างชุมชนตัวอย่างแล้ว รหัสเข้าร่วมของคุณคือ ${code}`
                    : "สร้างชุมชนส่วนตัวตัวอย่างแล้ว สามารถใช้รหัสที่ตั้งไว้เพื่อเข้าร่วม",
            );
        }
        createForm.reset();
        delete createForm.dataset.communityImage;
        const imagePreview = createForm.querySelector("[data-community-image-preview]");
        if (imagePreview) imagePreview.hidden = true;
        refreshCreateCode();
        if (privateCodeField) privateCodeField.required = false;
    });

    document.addEventListener("submit", (event) => {
        const form = event.target instanceof HTMLFormElement ? event.target : null;
        if (!form) return;

        if (form.matches("[data-community-transfer-form]")) {
            event.preventDefault();
            const detail = form.closest("[data-community-detail]");
            const communityId = detail?.dataset.communityId;
            const index = safeCreatedCommunities.findIndex((community) => community.id === communityId);
            const message = detail?.querySelector("[data-owner-message]");
            if (index < 0 || safeCreatedCommunities[index].owner !== currentUserName) {
                showMessage(message, "มีเพียงเจ้าของชุมชนเท่านั้นที่โอนความเป็นเจ้าของได้", true);
                return;
            }

            const previous = safeCreatedCommunities[index];
            const newOwnerInput = form.elements.namedItem("newOwner");
            const newOwner = newOwnerInput.value.trim();
            if (!newOwner || newOwner.toLocaleLowerCase() === currentUserName.toLocaleLowerCase()) {
                showMessage(message, "กรุณาระบุชื่อสมาชิกคนอื่นเพื่อรับช่วงเป็นเจ้าของ", true);
                return;
            }

            const updated = {
                ...previous,
                owner: newOwner,
                members: [...new Set([
                    ...previous.members.filter((member) =>
                        member.toLocaleLowerCase() !== currentUserName.toLocaleLowerCase()),
                    newOwner,
                ])],
            };
            const updatedCommunities = safeCreatedCommunities.map((community, communityIndex) =>
                communityIndex === index ? updated : community);
            const wasJoined = joinedCommunities.delete(previous.name);
            if (!writeStorage(createdStorageKey, updatedCommunities)) {
                if (wasJoined) joinedCommunities.add(previous.name);
                showMessage(message, "บันทึกเจ้าของชุมชนคนใหม่ไม่สำเร็จ", true);
                return;
            }
            if (!writeStorage(joinedStorageKey, [...joinedCommunities])) {
                if (wasJoined) joinedCommunities.add(previous.name);
                if (!writeStorage(createdStorageKey, safeCreatedCommunities)) {
                    console.error("Could not roll back the community owner after membership could not be saved.");
                }
                showMessage(message, "บันทึกการออกจากชุมชนไม่สำเร็จ จึงยกเลิกการโอนสิทธิ์", true);
                return;
            }

            safeCreatedCommunities[index] = updated;
            updateJoinButtons();
            showMessage(message, `โอนความเป็นเจ้าของให้ ${newOwner} และออกจากชุมชนแล้ว`);
            return;
        }

        if (form.matches("[data-community-member-remove-form]")) {
            event.preventDefault();
            const detail = form.closest("[data-community-detail]");
            const communityId = detail?.dataset.communityId;
            const index = safeCreatedCommunities.findIndex((community) => community.id === communityId);
            const message = detail?.querySelector("[data-owner-message]");
            if (index < 0 || safeCreatedCommunities[index].owner !== currentUserName) {
                showMessage(message, "มีเพียงเจ้าของชุมชนเท่านั้นที่จัดการสมาชิกได้", true);
                return;
            }
            const previous = safeCreatedCommunities[index];
            const memberSelect = form.elements.namedItem("member");
            const member = memberSelect.value;
            if (!member || member.toLocaleLowerCase() === previous.owner.toLocaleLowerCase()
                || !previous.members.some((name) => name === member)) {
                showMessage(message, "กรุณาเลือกสมาชิกที่ต้องการนำออก", true);
                return;
            }
            if (!window.confirm(`ต้องการนำ ${member} ออกจากชุมชน “${previous.name}” หรือไม่?`)) return;

            const updated = {
                ...previous,
                members: previous.members.filter((name) => name !== member),
            };
            const updatedCommunities = safeCreatedCommunities.map((community, communityIndex) =>
                communityIndex === index ? updated : community);
            if (!writeStorage(createdStorageKey, updatedCommunities)) {
                showMessage(message, "บันทึกการนำสมาชิกออกไม่สำเร็จ", true);
                return;
            }
            safeCreatedCommunities[index] = updated;
            if (member.toLocaleLowerCase() === currentUserName.toLocaleLowerCase()) {
                joinedCommunities.delete(previous.name);
                if (!writeStorage(joinedStorageKey, [...joinedCommunities])) {
                    safeCreatedCommunities[index] = previous;
                    if (!writeStorage(createdStorageKey, safeCreatedCommunities)) {
                        console.error("Could not roll back membership after its storage write failed.");
                    }
                    joinedCommunities.add(previous.name);
                    showMessage(message, "บันทึกการนำสมาชิกออกไม่สำเร็จ", true);
                    return;
                }
            }
            updateJoinButtons();
            showMessage(message, `นำ ${member} ออกจากชุมชนแล้ว`);
            return;
        }

        if (form.matches("[data-community-post-form]")) {
            event.preventDefault();
            const detail = form.closest("[data-community-detail]");
            const communityId = detail?.dataset.communityId;
            const communityName = detail?.dataset.communityName;
            const contentInput = form.elements.namedItem("content");
            const content = contentInput.value.trim();
            if (!communityId || !communityName || !content) {
                showMessage(form.querySelector("[data-post-message]"), "กรุณาเขียนข้อความก่อนโพสต์", true);
                return;
            }
            const posts = readArray(communityPostsStorageKey);
            const post = {
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                communityId,
                communityName,
                author: currentUserName,
                content,
                image: form.dataset.postImage || "",
                createdAt: new Date().toISOString(),
            };
            if (!writeStorage(communityPostsStorageKey, [post, ...posts])) {
                showMessage(form.querySelector("[data-post-message]"), "บันทึกโพสต์ไม่สำเร็จ กรุณาลองใหม่", true);
                return;
            }
            contentInput.value = "";
            delete form.dataset.postImage;
            const imageInput = form.querySelector("[data-community-post-image]");
            if (imageInput) imageInput.value = "";
            const preview = form.querySelector("[data-community-post-preview]");
            if (preview) preview.hidden = true;
            showMessage(form.querySelector("[data-post-message]"), "โพสต์ในชุมชนแล้ว");
            renderCommunityPosts();
            return;
        }

        if (form.matches("[data-community-comment-form]")) {
            event.preventDefault();
            const article = form.closest("[data-community-post-id]");
            const postId = article?.dataset.communityPostId;
            const input = form.elements.namedItem("content");
            const content = input.value.trim();
            if (!postId || !content) return;
            const comments = readStorage(communityCommentsStorageKey, {});
            const safeComments = comments && typeof comments === "object" && !Array.isArray(comments)
                ? comments
                : {};
            const key = communityCommentKey(postId);
            const records = normalizeCommunityComments(Array.isArray(safeComments[key]) ? safeComments[key] : []);
            records.push({
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                author: currentUserName,
                content,
                createdAt: new Date().toISOString(),
            });
            if (!writeStorage(communityCommentsStorageKey, { ...safeComments, [key]: records })) {
                showCommunityToast("บันทึกความคิดเห็นไม่สำเร็จ กรุณาลองใหม่");
                return;
            }
            renderCommunityPosts();
            return;
        }

        if (form.matches("[data-community-edit-form]")) {
            event.preventDefault();
            const detail = form.closest("[data-community-detail]");
            const communityId = detail?.dataset.communityId;
            const name = form.elements.namedItem("name").value.trim();
            const description = form.elements.namedItem("description").value.trim();
            const message = form.querySelector("[data-edit-message]");
            const index = safeCreatedCommunities.findIndex((community) => community.id === communityId);
            if (index < 0) {
                showMessage(message, "แก้ไขได้เฉพาะชุมชนที่คุณสร้าง", true);
                return;
            }
            const previous = safeCreatedCommunities[index];
            const duplicate = safeCreatedCommunities.some((community, communityIndex) =>
                communityIndex !== index && community.name.toLocaleLowerCase() === name.toLocaleLowerCase());
            if (duplicate || !name) {
                showMessage(message, duplicate ? "มีชุมชนชื่อนี้อยู่แล้ว กรุณาใช้ชื่ออื่น" : "กรุณาระบุชื่อชุมชน", true);
                return;
            }
            const updated = {
                ...previous,
                name,
                description,
                image: form.dataset.communityImage || "",
            };
            const joined = joinedCommunities.has(previous.name);
            if (joined) {
                joinedCommunities.delete(previous.name);
                joinedCommunities.add(name);
                if (!writeStorage(joinedStorageKey, [...joinedCommunities])) {
                    joinedCommunities.delete(name);
                    joinedCommunities.add(previous.name);
                    showMessage(message, "บันทึกการเปลี่ยนชื่อในรายชื่อชุมชนไม่สำเร็จ", true);
                    return;
                }
            }
            const updatedCommunities = safeCreatedCommunities.map((community, communityIndex) =>
                communityIndex === index ? updated : community);
            if (!writeStorage(createdStorageKey, updatedCommunities)) {
                if (joined) {
                    joinedCommunities.delete(name);
                    joinedCommunities.add(previous.name);
                    writeStorage(joinedStorageKey, [...joinedCommunities]);
                }
                showMessage(message, "บันทึกการแก้ไขชุมชนไม่สำเร็จ", true);
                return;
            }
            safeCreatedCommunities[index] = updated;
            detail.dataset.communityName = name;
            detail.querySelectorAll("[data-community-join]").forEach((button) => {
                button.dataset.communityJoin = name;
            });
            detail.querySelector(".community-detail-top h2").textContent = name;
            detail.querySelector(".community-detail-top p").textContent = description;
            setCommunityMark(detail.querySelector(".community-detail-top .community-mark"), name, updated.image);
            const codeElement = detail.querySelector(".community-invite-code code");
            if (codeElement) codeElement.textContent = updated.code;
            const card = [...document.querySelectorAll("[data-community-card]")]
                .find((item) => item.dataset.communityName === previous.name);
            if (card) {
                card.dataset.communityName = name;
                card.querySelector("h3").textContent = name;
                card.querySelector("p").textContent = description;
                setCommunityMark(card.querySelector(".community-mark"), name, updated.image);
            }
            updateJoinButtons();
            filterCommunities();
            showMessage(message, "บันทึกการแก้ไขชุมชนแล้ว");
        }
    });

    document.querySelector("[data-community-join-form]")?.addEventListener("submit", (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const input = form.querySelector("#community-join-code");
        const message = form.querySelector("[data-join-message]");
        const code = input.value.trim().toLocaleUpperCase();
        const staticMatch = Object.entries(communityCodes).find(([, value]) =>
            typeof value === "string" && value.toLocaleUpperCase() === code);
        const createdMatch = safeCreatedCommunities.find((community) => community.code.toLocaleUpperCase() === code);
        const name = staticMatch?.[0] || createdMatch?.name;
        if (!name) {
            showMessage(message, "ไม่พบชุมชนจากรหัสนี้ ตรวจสอบรหัสแล้วลองอีกครั้ง", true);
            return;
        }

        const wasJoined = joinedCommunities.has(name);
        joinedCommunities.add(name);
        if (createdMatch && !createdMatch.members.some((member) =>
            member.toLocaleLowerCase() === currentUserName.toLocaleLowerCase())) {
            const previousMembers = createdMatch.members;
            createdMatch.members = [...previousMembers, currentUserName];
            if (!writeStorage(createdStorageKey, safeCreatedCommunities)) {
                createdMatch.members = previousMembers;
                showMessage(message, "บันทึกสมาชิกชุมชนไม่สำเร็จ", true);
                return;
            }
        }
        if (!writeStorage(joinedStorageKey, [...joinedCommunities])) {
            if (!wasJoined) joinedCommunities.delete(name);
            if (createdMatch) {
                createdMatch.members = createdMatch.members.filter((member) =>
                    member.toLocaleLowerCase() !== currentUserName.toLocaleLowerCase()
                    || createdMatch.owner.toLocaleLowerCase() === currentUserName.toLocaleLowerCase());
                if (!writeStorage(createdStorageKey, safeCreatedCommunities)) {
                    console.error("Could not roll back community membership after storage write failed.");
                }
            }
            showMessage(message, "บันทึกการเข้าร่วมในเบราว์เซอร์ไม่สำเร็จ", true);
            return;
        }
        updateJoinButtons();
        showMessage(message, `เข้าร่วมชุมชน “${name}” แล้ว`);
        input.value = "";
    });

    document.addEventListener("click", (event) => {
        const editCommunityPostButton = event.target instanceof Element
            ? event.target.closest("[data-community-post-edit]")
            : null;
        if (editCommunityPostButton) {
            const article = editCommunityPostButton.closest("[data-community-post-id]");
            const postId = article?.dataset.communityPostId;
            const source = article?.dataset.postSource;
            const storageKey = source === "feed" ? "learnlink.posts.v1" : communityPostsStorageKey;
            const posts = readArray(storageKey);
            const post = posts.find((item) => item.id === postId);
            const content = article?.querySelector(".community-post-content");
            if (!article || !post || post.author !== currentUserName || !content
                || article.querySelector(".inline-edit-form")) return;
            const editor = createCommunityInlineEditor(post.content, (updatedContent) => {
                const latest = readArray(storageKey);
                const index = latest.findIndex((item) =>
                    item.id === postId && item.author === currentUserName);
                if (index < 0) {
                    showCommunityToast("ไม่พบโพสต์นี้ หรือคุณไม่มีสิทธิ์แก้ไข");
                    return;
                }
                latest[index] = { ...latest[index], content: updatedContent, updatedAt: new Date().toISOString() };
                if (!writeStorage(storageKey, latest)) return;
                renderCommunityPosts();
                showCommunityToast("แก้ไขโพสต์แล้ว");
            }, () => renderCommunityPosts());
            content.after(editor);
            editor.querySelector("textarea")?.focus();
            return;
        }

        const deleteCommunityPostButton = event.target instanceof Element
            ? event.target.closest("[data-community-post-delete]")
            : null;
        if (deleteCommunityPostButton) {
            const article = deleteCommunityPostButton.closest("[data-community-post-id]");
            const postId = article?.dataset.communityPostId;
            const source = article?.dataset.postSource;
            const storageKey = source === "feed" ? "learnlink.posts.v1" : communityPostsStorageKey;
            const posts = readArray(storageKey);
            const post = posts.find((item) => item.id === postId);
            if (!article || !post || post.author !== currentUserName) return;
            if (!window.confirm("ต้องการลบโพสต์นี้หรือไม่?")) return;
            const nextPosts = posts.filter((item) => item.id !== postId);
            const allComments = readStorage(communityCommentsStorageKey, {});
            const comments = allComments && typeof allComments === "object" && !Array.isArray(allComments)
                ? allComments
                : {};
            const nextComments = { ...comments };
            delete nextComments[communityCommentKey(postId)];
            if (!writeStorage(storageKey, nextPosts)) return;
            if (!writeStorage(communityCommentsStorageKey, nextComments)) {
                if (!writeStorage(storageKey, posts)) {
                    console.error("Could not restore a community post after comment cleanup failed.");
                }
                return;
            }
            renderCommunityPosts();
            showCommunityToast("ลบโพสต์แล้ว");
            return;
        }

        const editCommunityCommentButton = event.target instanceof Element
            ? event.target.closest("[data-community-comment-edit]")
            : null;
        if (editCommunityCommentButton) {
            const article = editCommunityCommentButton.closest("[data-community-post-id]");
            const item = editCommunityCommentButton.closest("[data-community-comment-id]");
            const postId = article?.dataset.communityPostId;
            const commentId = item?.dataset.communityCommentId;
            const allComments = readStorage(communityCommentsStorageKey, {});
            const comments = allComments && typeof allComments === "object" && !Array.isArray(allComments)
                ? allComments
                : {};
            const key = communityCommentKey(postId);
            const records = normalizeCommunityComments(Array.isArray(comments[key]) ? comments[key] : []);
            const comment = records.find((entry) => entry.id === commentId);
            const content = item?.querySelector("p");
            if (!item || !comment || comment.author !== currentUserName || !content
                || item.querySelector(".inline-edit-form")) return;
            const editor = createCommunityInlineEditor(comment.content, (updatedContent) => {
                const latestComments = readStorage(communityCommentsStorageKey, {});
                const safeComments = latestComments && typeof latestComments === "object" && !Array.isArray(latestComments)
                    ? latestComments
                    : {};
                const latest = normalizeCommunityComments(Array.isArray(safeComments[key]) ? safeComments[key] : []);
                const index = latest.findIndex((entry) => entry.id === commentId && entry.author === currentUserName);
                if (index < 0) return;
                latest[index] = { ...latest[index], content: updatedContent, updatedAt: new Date().toISOString() };
                if (!writeStorage(communityCommentsStorageKey, { ...safeComments, [key]: latest })) return;
                renderCommunityPosts();
                showCommunityToast("แก้ไขความคิดเห็นแล้ว");
            }, () => renderCommunityPosts());
            content.after(editor);
            editor.querySelector("textarea")?.focus();
            return;
        }

        const deleteCommunityCommentButton = event.target instanceof Element
            ? event.target.closest("[data-community-comment-delete]")
            : null;
        if (deleteCommunityCommentButton) {
            const article = deleteCommunityCommentButton.closest("[data-community-post-id]");
            const item = deleteCommunityCommentButton.closest("[data-community-comment-id]");
            const postId = article?.dataset.communityPostId;
            const commentId = item?.dataset.communityCommentId;
            const allComments = readStorage(communityCommentsStorageKey, {});
            const comments = allComments && typeof allComments === "object" && !Array.isArray(allComments)
                ? allComments
                : {};
            const key = communityCommentKey(postId);
            const records = normalizeCommunityComments(Array.isArray(comments[key]) ? comments[key] : []);
            const comment = records.find((entry) => entry.id === commentId);
            if (!comment || comment.author !== currentUserName) return;
            if (!window.confirm("ต้องการลบความคิดเห็นนี้หรือไม่?")) return;
            const updated = records.filter((entry) => entry.id !== commentId);
            if (!writeStorage(communityCommentsStorageKey, { ...comments, [key]: updated })) return;
            renderCommunityPosts();
            showCommunityToast("ลบความคิดเห็นแล้ว");
            return;
        }

        const clearPostsButton = event.target instanceof Element
            ? event.target.closest("[data-community-clear-posts]")
            : null;
        if (clearPostsButton) {
            const detail = clearPostsButton.closest("[data-community-detail]");
            const communityId = detail?.dataset.communityId;
            const index = safeCreatedCommunities.findIndex((community) => community.id === communityId);
            const message = detail?.querySelector("[data-owner-message]");
            if (index < 0 || safeCreatedCommunities[index].owner !== currentUserName) {
                showMessage(message, "มีเพียงเจ้าของชุมชนเท่านั้นที่ลบโพสต์ทั้งหมดได้", true);
                return;
            }
            const community = safeCreatedCommunities[index];
            if (!window.confirm(`ต้องการลบโพสต์และความคิดเห็นทั้งหมดใน “${community.name}” หรือไม่?`)) return;

            const belongsToCommunity = (post) => post.communityId === community.id
                || post.communityName === community.name
                || post.kind === community.name
                || matchesCommunity(community, `${post.kind || ""} ${post.content || ""}`);
            const previousCommunityPosts = readArray(communityPostsStorageKey);
            const removedCommunityPosts = previousCommunityPosts.filter((post) =>
                post.communityId === community.id);
            const nextCommunityPosts = previousCommunityPosts.filter((post) =>
                post.communityId !== community.id);
            const previousFeedPosts = readArray("learnlink.posts.v1");
            const removedFeedPosts = previousFeedPosts.filter(belongsToCommunity);
            const nextFeedPosts = previousFeedPosts.filter((post) => !belongsToCommunity(post));
            const commentKeys = [
                ...removedCommunityPosts.map((post) => communityCommentKey(post.id)),
                ...removedFeedPosts.map((post) => `local-${post.id}`),
            ];
            const previousComments = readStorage(communityCommentsStorageKey, {});
            const commentsObject = previousComments && typeof previousComments === "object" && !Array.isArray(previousComments)
                ? previousComments
                : {};
            const nextComments = { ...commentsObject };
            commentKeys.forEach((key) => delete nextComments[key]);
            const previousClearedIds = readArray(communityClearedPostsStorageKey);
            const nextClearedIds = [...new Set([...previousClearedIds, community.id])];
            const removedPostKeys = [
                ...removedCommunityPosts.map((post) => `local-${post.id}`),
                ...removedFeedPosts.map((post) => `local-${post.id}`),
            ];
            const storageChanges = [
                { key: communityPostsStorageKey, previous: previousCommunityPosts, next: nextCommunityPosts },
                { key: "learnlink.posts.v1", previous: previousFeedPosts, next: nextFeedPosts },
                { key: communityCommentsStorageKey, previous: commentsObject, next: nextComments },
                { key: communityClearedPostsStorageKey, previous: previousClearedIds, next: nextClearedIds },
                { key: "learnlink.likes.v1", previous: readArray("learnlink.likes.v1"), next: readArray("learnlink.likes.v1").filter((key) => !removedPostKeys.includes(key)) },
                { key: "learnlink.saved.v1", previous: readArray("learnlink.saved.v1"), next: readArray("learnlink.saved.v1").filter((key) => !removedPostKeys.includes(key)) },
            ];
            const savedChanges = [];
            for (const change of storageChanges) {
                if (!writeStorage(change.key, change.next)) {
                    savedChanges.reverse().forEach((savedChange) => {
                        if (!writeStorage(savedChange.key, savedChange.previous)) {
                            console.error(`Could not roll back community post cleanup (${savedChange.key}).`);
                        }
                    });
                    showMessage(message, "ลบโพสต์ทั้งหมดไม่สำเร็จ กรุณาลองใหม่", true);
                    return;
                }
                savedChanges.push(change);
            }
            renderCommunityPosts();
            showMessage(message, "ลบโพสต์และความคิดเห็นทั้งหมดในชุมชนแล้ว");
            return;
        }

        const deleteButton = event.target instanceof Element
            ? event.target.closest("[data-community-delete]")
            : null;
        if (deleteButton) {
            const detail = deleteButton.closest("[data-community-detail]");
            const communityId = detail?.dataset.communityId;
            const index = safeCreatedCommunities.findIndex((community) => community.id === communityId);
            const message = detail?.querySelector("[data-owner-message]");
            if (index < 0 || safeCreatedCommunities[index].owner !== currentUserName) {
                showMessage(message, "มีเพียงเจ้าของชุมชนเท่านั้นที่ลบชุมชนได้", true);
                return;
            }
            const community = safeCreatedCommunities[index];
            if (!window.confirm(`ต้องการลบชุมชน “${community.name}” และโพสต์ทั้งหมดหรือไม่?`)) return;

            const storageChanges = [
                {
                    key: createdStorageKey,
                    previous: readStorage(createdStorageKey, []),
                    next: safeCreatedCommunities.filter((item) => item.id !== community.id),
                },
                {
                    key: joinedStorageKey,
                    previous: readStorage(joinedStorageKey, []),
                    next: [...joinedCommunities].filter((name) => name !== community.name),
                },
                {
                    key: communityPostsStorageKey,
                    previous: readStorage(communityPostsStorageKey, []),
                    next: readArray(communityPostsStorageKey)
                        .filter((post) => post.communityId !== community.id),
                },
            ];
            const feedPosts = readStorage("learnlink.posts.v1", null);
            if (Array.isArray(feedPosts)) {
                storageChanges.push({
                    key: "learnlink.posts.v1",
                    previous: feedPosts,
                    next: feedPosts.filter((post) => post.communityId !== community.id),
                });
            }

            const savedChanges = [];
            for (const change of storageChanges) {
                if (!writeStorage(change.key, change.next)) {
                    savedChanges.reverse().forEach((savedChange) => {
                        if (!writeStorage(savedChange.key, savedChange.previous)) {
                            console.error(`Could not roll back community deletion data (${savedChange.key}).`);
                        }
                    });
                    showMessage(message, "ลบชุมชนไม่สำเร็จ กรุณาลองใหม่", true);
                    return;
                }
                savedChanges.push(change);
            }

            joinedCommunities.delete(community.name);
            safeCreatedCommunities.splice(index, 1);
            const card = [...document.querySelectorAll("[data-community-card]")]
                .find((item) => item.dataset.communityId === community.id);
            card?.remove();
            detail?.remove();
            updateJoinButtons();
            filterCommunities();
            renderCommunityPosts();
            if (window.location.hash === `#created-community-${community.id}`) {
                window.location.hash = "#communities-page";
            }
            return;
        }

        const button = event.target instanceof Element ? event.target.closest("[data-community-join]") : null;
        if (!button) return;
        if (button.disabled) return;

        const name = button.dataset.communityJoin;
        const joined = joinedCommunities.has(name);
        const community = safeCreatedCommunities.find((item) => item.name === name);
        const previousMembers = community ? [...community.members] : null;
        if (joined) {
            joinedCommunities.delete(name);
            if (community) {
                community.members = community.members.filter((member) =>
                    member.toLocaleLowerCase() !== currentUserName.toLocaleLowerCase());
                if (!writeStorage(createdStorageKey, safeCreatedCommunities)) {
                    community.members = previousMembers;
                    joinedCommunities.add(name);
                    return;
                }
            }
        } else {
            joinedCommunities.add(name);
            if (community && !community.members.some((member) =>
                member.toLocaleLowerCase() === currentUserName.toLocaleLowerCase())) {
                community.members.push(currentUserName);
                if (!writeStorage(createdStorageKey, safeCreatedCommunities)) {
                    community.members = previousMembers;
                    joinedCommunities.delete(name);
                    return;
                }
            }
        }
        if (!writeStorage(joinedStorageKey, [...joinedCommunities])) {
            if (joined) joinedCommunities.add(name);
            else joinedCommunities.delete(name);
            if (community && previousMembers) {
                community.members = previousMembers;
                if (!writeStorage(createdStorageKey, safeCreatedCommunities)) {
                    console.error("Could not roll back community membership after storage write failed.");
                }
            }
            return;
        }
        updateJoinButtons();
    });
})();
