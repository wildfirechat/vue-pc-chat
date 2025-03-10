<template>
    <div class="moments-container">
        <div class="scrollable-content" ref="scrollContainerRef" infinite-wrapper @scroll="onScroll">
            <!-- Header that scrolls with content -->
            <div class="moments-header">
                <div class="cover-image">
                    <div class="cover-background"></div>
                </div>
                <div class="user-profile">
                    <span class="nickname">{{ userInfo ? userInfo.displayName : '用户' }}</span>
                    <img :src="userInfo ? userInfo.portrait : defaultAvatar" alt="Profile photo" class="avatar">
                </div>
            </div>

            <!-- Timeline content -->
            <div class="moments-content">
                <div class="feeds-list" ref="feedsListRef">

                    <!-- Feed items -->
                    <div v-for="feed in feeds" :key="feed.feedId" class="feed-item">
                        <!-- Restructured feed item layout -->
                        <div class="feed-sender">
                            <img :src="feed.user ? feed.user.portrait : defaultAvatar" alt="avatar" class="avatar"
                                @click="viewUserInfo(feed.user)" />
                        </div>

                        <div class="feed-body">
                            <!-- Move sender name to top of feed body -->
                            <div class="sender-name" @click="viewUserInfo(feed.user)">
                                {{ feed.user ? feed.user.displayName : '用户' }}
                            </div>

                            <p class="feed-text" v-if="feed.text">{{ feed.text }}</p>

                            <div v-if="feed.medias && feed.medias.length > 0" class="feed-media-grid"
                                :class="getMediaGridClass(feed.medias.length)">
                                <div v-for="(media, mIndex) in feed.medias" :key="mIndex" class="media-wrapper"
                                    @click="previewMedia(feed.medias, mIndex)">
                                    <img :src="media.thumbUrl || media.mediaUrl" :alt="`媒体${mIndex + 1}`"
                                        class="media-thumbnail" />
                                </div>
                            </div>

                            <div class="feed-meta">
                                <span class="timestamp">{{ formatTime(feed.serverTime) }}</span>

                                <div class="feed-actions-dropdown">
                                    <div class="actions-trigger" @click="toggleActions(feed)">
                                        <i class="icon-ion-android-more-horizontal"></i>
                                    </div>
                                    <div v-if="feed.showActions" class="actions-menu">
                                        <div class="action-item" @click="likeFeed(feed)">
                                            <i
                                                :class="[isLikedByMe(feed) ? 'icon-ion-android-favorite' : 'icon-ion-android-favorite-outline']"></i>
                                            <span>{{ isLikedByMe(feed) ? '取消' : '赞' }}</span>
                                        </div>
                                        <div class="action-item" @click="showCommentInput(feed)">
                                            <i class="icon-ion-chatbubble-working"></i>
                                            <span>评论</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div v-if="hasReactions(feed)" class="reactions-panel">
                                <div v-if="feed.likes && feed.likes.length > 0" class="likes-area">
                                    <i class="icon-ion-heart"></i>
                                    <div class="like-users">
                                        <span v-for="(like, lIndex) in feed.likes" :key="like.userId" class="like-user"
                                            @click="viewUserInfo(like.user)">
                                            {{ like.user ? like.user.displayName : '用户' }}
                                            <template v-if="lIndex < feed.likes.length - 1">, </template>
                                        </span>
                                    </div>
                                </div>

                                <div v-if="feed.comments && feed.comments.length > 0" class="comments-area">
                                    <div v-for="comment in feed.comments" :key="comment.commentId" class="comment-item">
                                        <span class="commenter-name" @click="viewUserInfo(comment.user)">
                                            {{ comment.user ? comment.user.displayName : '用户' }}:
                                        </span>
                                        <span class="comment-text">{{ comment.text }}</span>
                                    </div>
                                </div>
                            </div>

                            <!-- Comment input area -->
                            <div v-if="currentCommentingFeed && currentCommentingFeed.feedId === feed.feedId"
                                class="comment-input-container">
                                <input type="text" class="comment-input" v-model="commentText" placeholder="评论..."
                                    ref="commentInputRef" @keyup.enter="submitComment" />
                                <button class="comment-submit-btn" @click="submitComment"
                                    :disabled="!commentText.trim()">发送</button>
                            </div>
                        </div>
                    </div>
                    <!-- Single infinite loading component that handles both directions -->
                    <infinite-loading :identifier="loadingIdentifier" :distance="10" :force-use-infinite-wrapper="true"
                        direction="bottom" @infinite="infiniteHandler">
                        <template #spinner>
                            <div class="custom-spinner">
                                <i class="icon-ion-refresh rotating"></i>
                                <span>加载中...</span>
                            </div>
                        </template>
                        <template #no-more>没有更多内容了</template>
                        <template #no-results>
                            <div class="empty-state">
                                <i class="icon-ion-sad-outline"></i>
                                <p>还没有任何朋友圈内容</p>
                                <button @click="showPublishDialog" class="empty-publish-btn">发布第一条朋友圈</button>
                            </div>
                        </template>
                    </infinite-loading>
                </div>
            </div>
        </div>

        <!-- Floating publish button - always visible -->
        <div class="publish-fab" @click="showPublishDialog">
            <i class="icon-ion-edit"></i>
        </div>

        <!-- Publish moment modal -->
        <div v-if="showPublishModal" class="modal-overlay" @click.self="closePublishModal">
            <div class="publish-modal">
                <div class="publish-header">
                    <h2>发布朋友圈</h2>
                    <div class="actions">
                        <button @click="closePublishModal" class="cancel-btn">取消</button>
                        <button @click="publishFeed" class="publish-btn" :disabled="isPublishing || !canPublish">发布</button>
                    </div>
                </div>
                <div class="publish-content">
                    <div class="text-input-container">
                        <textarea
                            v-model="publishText"
                            placeholder="分享你的想法..."
                            class="text-input"
                            ref="textareaRef"
                            @input="adjustHeight"
                        ></textarea>
                    </div>
                    <div class="media-preview" v-if="selectedMedia.length > 0">
                        <div v-for="(media, index) in selectedMedia" :key="index" class="media-item-container">
                            <div class="delete-media" @click="removeMedia(index)">
                                <i class="icon-ion-close-circled"></i>
                            </div>
                            <img :src="media.preview" alt="media preview" class="media-preview-item" />
                        </div>
                        <div class="add-media-btn" @click="selectMedia" v-if="selectedMedia.length < 9">
                            <i class="icon-ion-plus"></i>
                        </div>
                    </div>
                    <div class="media-upload" v-else>
                        <button @click="selectMedia" class="upload-btn">
                            <i class="icon-ion-image"></i>
                            添加图片
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import wfc from "../../../wfc/client/wfc";
import momentClient from "../../../moment/client/momentClient";
import InfiniteLoading from '@imndx/vue-infinite-loading';
import FeedCommentType from "../../../moment/const/feedCommentType";
import Comment from "../../../moment/model/comment";
import FeedContentType from "../../../moment/const/feedContentType";

export default {
    name: "MomentList",
    components: {
        InfiniteLoading
    },
    data() {
        return {
            feeds: [],
            loading: true,
            userInfo: null,
            defaultAvatar: require('../../../assets/images/user-fallback.png'),
            currentUserId: wfc.getUserId(),

            // For comment functionality
            currentCommentingFeed: null,
            commentText: '',

            // For publish modal
            showPublishModal: false,
            publishText: '',
            selectedMedia: [],
            isPublishing: false,

            // For pagination
            pageSize: 20,
            loadingIdentifier: 0,

            // For auto-scroll
            shouldAutoScrollToBottom: true,
            enableLoadRemoteHistoryFeed: true,
        };
    },
    computed: {
        canPublish() {
            return (this.publishText.trim() !== '' || this.selectedMedia.length > 0) && !this.isPublishing;
        }
    },
    methods: {
        fetchCurrentUserInfo() {
            this.userInfo = wfc.getUserInfo(this.currentUserId, false);
        },

        // Show comment input for a specific feed
        showCommentInput(feed) {
            // Hide action menu when showing comment input
            feed.showActions = false;

            // Set current commenting feed
            this.currentCommentingFeed = feed;

            // Focus the input after it's rendered
            this.$nextTick(() => {
                if (this.$refs.commentInputRef) {
                    this.$refs.commentInputRef.focus();
                }
            });
        },

        // Submit comment
        submitComment() {
            if (!this.commentText.trim() || !this.currentCommentingFeed) return;

            const feed = this.currentCommentingFeed;
            const text = this.commentText.trim();

            momentClient.postComment(FeedCommentType.Comment_Comment_Type, feed.feedId, text, null, null,
                (commentId, timestamp) => {
                    console.log("Comment posted successfully");

                    // Update just this feed to reflect the new comment
                    if (!feed.comments) feed.comments = [];
                    feed.comments.push({
                        commentId: commentId,
                        text: text,
                        timestamp: timestamp,
                        userId: this.currentUserId,
                        user: this.userInfo
                    });

                    // Reset state
                    this.commentText = '';
                    this.currentCommentingFeed = null;
                },
                err => {
                    console.error("Failed to post comment:", err);
                }
            );
        },

        // Fetch feeds for infinite loading
        loadFeedHistory(callback, complete) {
            let fromIndex = this.feeds.length > 0 ? this.feeds[this.feeds.length - 1].feedId : 0;
            console.log("Loading feed history, fromIndex:", fromIndex);

            momentClient.getFeeds(fromIndex, this.pageSize, null, fetchedFeeds => {
                console.log("Fetched feeds:", fetchedFeeds);

                if (fetchedFeeds && fetchedFeeds.length > 0) {
                    fetchedFeeds.map(feed => {
                        feed.user = wfc.getUserInfo(feed.sender)
                        if (feed.comments) {
                            feed.comments.map(comment => {
                                comment.user = wfc.getUserInfo(comment.sender)
                            })
                            feed.likes = feed.comments.filter(comment => comment.type === FeedCommentType.Comment_Thumbup_Type);
                            feed.comments = feed.comments.filter(comment => comment.type === FeedCommentType.Comment_Comment_Type);
                        }
                    })
                    this.feeds = [...this.feeds, ...fetchedFeeds];
                    callback && callback();
                } else {
                    // No more feeds
                    complete && complete();
                }

                this.loading = false;
            }, err => {
                console.error("Failed to fetch feeds:", err);
                this.loading = false;
                complete && complete();
            });
        },

        // Infinite loading handler
        infiniteHandler($state) {
            console.log("Infinite handler triggered");
            this.loadFeedHistory(() => {
                $state.loaded();
            }, () => {
                $state.complete();
            });
        },

        // Refresh feeds by changing identifier
        refreshFeeds() {
            this.feeds = [];
            this.loadingIdentifier = Date.now();
            this.enableLoadRemoteHistoryFeed = true;
        },

        // Updated scroll event handler to hide all action menus and comment input
        onScroll(e) {
            // When user scrolls up a bit, disable auto-scrolling to bottom on new messages
            if (e.target.scrollTop < e.target.scrollHeight - e.target.clientHeight - 100) {
                this.shouldAutoScrollToBottom = false;
            } else {
                this.shouldAutoScrollToBottom = true;
            }

            // Hide all action menus and comment input when scrolling
            this.hideAllActionMenus();
            this.currentCommentingFeed = null;
        },

        // New function to hide all action menus
        hideAllActionMenus() {
            this.feeds.forEach(feed => {
                if (feed.showActions) {
                    feed.showActions = false;
                }
            });
        },

        // Publish modal functions
        showPublishDialog() {
            this.showPublishModal = true;
            this.publishText = '';
            this.selectedMedia = [];
            this.$nextTick(() => {
                if (this.$refs.textareaRef) {
                    this.$refs.textareaRef.focus();
                }
            });
        },

        closePublishModal() {
            this.showPublishModal = false;
            this.publishText = '';
            this.selectedMedia = [];
        },

        adjustHeight() {
            if (this.$refs.textareaRef) {
                this.$refs.textareaRef.style.height = 'auto';
                this.$refs.textareaRef.style.height = this.$refs.textareaRef.scrollHeight + 'px';
            }
        },

        selectMedia() {
            // Create file input for image selection
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.multiple = true;
            input.onchange = (e) => {
                const files = e.target.files;
                if (files && files.length > 0) {
                    this.handleSelectedFiles(files);
                }
            };
            input.click();
        },

        handleSelectedFiles(files) {
            const remainingSlots = 9 - this.selectedMedia.length;
            const filesToProcess = Array.from(files).slice(0, remainingSlots);

            filesToProcess.forEach(file => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    this.selectedMedia.push({
                        file: file,
                        preview: e.target.result
                    });
                };
                reader.readAsDataURL(file);
            });
        },

        removeMedia(index) {
            this.selectedMedia.splice(index, 1);
        },

        publishFeed() {
            if (!this.canPublish) return;

            this.isPublishing = true;

            if (this.selectedMedia.length > 0) {
                // With media
                const mediaFiles = this.selectedMedia.map(media => media.file);

                // Create an array of promises for each file upload
                const uploadPromises = mediaFiles.map(file => {
                    return new Promise((resolve, reject) => {
                        momentClient.uploadMedia('', file, (remoteUrl) => {
                            console.log("Media uploaded successfully");
                            resolve(remoteUrl);
                        }, error => {
                            console.error("Failed to upload media:", error);
                            reject(error);
                        });
                    });
                });

                // Wait for all uploads to complete
                Promise.all(uploadPromises).then(remoteUrls => {
                    let mediaEntrys = remoteUrls.map(remoteUrl => {
                        // Create media entry
                        return {
                            mediaUrl: remoteUrl
                        };
                    });

                    // Post feed with uploaded media
                    momentClient.postFeed(
                        FeedContentType.Content_Image_Type,
                        this.publishText,
                        mediaEntrys,
                        [], [], [], '',
                        () => {
                            console.log("Feed published successfully with media");
                            this.isPublishing = false;
                            this.closePublishModal();
                            this.refreshFeeds();
                        },
                        error => {
                            console.error("Failed to publish feed with media:", error);
                            this.isPublishing = false;
                            alert("发布失败，请重试");
                        }
                    );
                }).catch(err => {
                    console.error("Failed during media upload:", err);
                    this.isPublishing = false;
                    alert("上传图片失败，请重试");
                });
            } else {
                // Text only
                momentClient.postFeed(
                    FeedContentType.Content_Text_Type,
                    this.publishText,
                    [],
                    [], [], [], '',
                    () => {
                        console.log("Text feed published successfully");
                        this.isPublishing = false;
                        this.closePublishModal();
                        this.refreshFeeds();
                    },
                    error => {
                        console.error("Failed to publish text feed:", error);
                        this.isPublishing = false;
                        alert("发布失败，请重试");
                    }
                );
            }
        },

        formatTime(timestamp) {
            if (!timestamp) return '';
            const date = new Date(timestamp);
            const now = new Date();
            const diffMs = now - date;
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMs / 3600000);
            const diffDays = Math.floor(diffMs / 86400000);

            // Within the last hour
            if (diffMins < 60) {
                return diffMins <= 1 ? '刚刚' : `${diffMins}分钟前`;
            }

            // Within the same day
            if (diffHours < 24) {
                return `${diffHours}小时前`;
            }

            // Yesterday
            if (diffDays === 1) {
                return `昨天 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
            }

            // Within a week
            if (diffDays < 7) {
                return `${diffDays}天前`;
            }

            // More than a week
            const year = date.getFullYear() === now.getFullYear() ? '' : `${date.getFullYear()}年`;
            return `${year}${date.getMonth() + 1}月${date.getDate()}日`;
        },

        toggleActions(feed) {
            // Hide any other open action menus and comment input
            this.hideAllActionMenus();
            this.currentCommentingFeed = null;

            // Toggle the clicked feed's actions
            feed.showActions = !feed.showActions;
        },

        likeFeed(feed) {
            // Hide the actions menu
            feed.showActions = false;

            const like = feed.likes ? feed.likes.find(like => like.sender === this.currentUserId) : null;
            if (like) {
                momentClient.deleteComment(like.commentId, feed.feedId, () => {
                    feed.likes = feed.likes.filter(like => like.sender !== this.currentUserId);
                }, err => {
                    console.error("Failed to unlike feed:", err);
                });
            } else {
                momentClient.postComment(FeedCommentType.Comment_Thumbup_Type, feed.feedId, '', '', '', () => {
                    // Update just this feed to reflect change
                    if (!feed.likes) feed.likes = [];
                    let like = new Comment();
                    like.sender = this.currentUserId;
                    like.user = this.userInfo;
                    like.type = FeedCommentType.Comment_Thumbup_Type;
                    feed.likes.push(like);
                }, err => {
                    console.error("Failed to like feed:", err);
                });
            }
        },

        isLikedByMe(feed) {
            if (!feed.likes) return false;
            return feed.likes.some(like => like.sender === this.currentUserId);
        },

        commentFeed(feed) {
            // No longer needed as we now use showCommentInput
            this.showCommentInput(feed);
        },

        previewMedia(medias, index) {
            // Create a lightbox-like preview for images
            const overlay = document.createElement('div');
            overlay.style.position = 'fixed';
            overlay.style.top = '0';
            overlay.style.left = '0';
            overlay.style.width = '100%';
            overlay.style.height = '100%';
            overlay.style.backgroundColor = 'rgba(0,0,0,0.9)';
            overlay.style.zIndex = '1000';
            overlay.style.display = 'flex';
            overlay.style.justifyContent = 'center';
            overlay.style.alignItems = 'center';

            const img = document.createElement('img');
            img.src = medias[index].mediaUrl;
            img.style.maxWidth = '90%';
            img.style.maxHeight = '90%';
            img.style.objectFit = 'contain';

            overlay.appendChild(img);
            document.body.appendChild(overlay);

            // Close on click
            overlay.addEventListener('click', () => {
                document.body.removeChild(overlay);
            });
        },

        viewUserInfo(user) {
            if (user && user.uid) {
                // Show user info card or navigate to user profile
                console.log("View user info", user);
            }
        },

        hasReactions(feed) {
            return (feed.likes && feed.likes.length > 0) ||
                (feed.comments && feed.comments.length > 0);
        },

        getMediaGridClass(count) {
            if (count === 1) return 'grid-1';
            if (count === 2) return 'grid-2';
            if (count === 3) return 'grid-3';
            if (count === 4) return 'grid-4';
            if (count === 5 || count === 6) return 'grid-6';
            if (count >= 7) return 'grid-9';
            return '';
        },
    },
    mounted() {
        this.fetchCurrentUserInfo();

        // Add event listener to handle clicks outside comment area
        document.addEventListener('click', (e) => {
            // Close comment input when clicking outside unless it's the comment button
            if (this.currentCommentingFeed &&
                !e.target.closest('.comment-input-container') &&
                !e.target.closest('.action-item')) {
                this.currentCommentingFeed = null;
            }

            // Check if the click is outside the action menu and trigger
            if (!e.target.closest('.feed-actions-dropdown')) {
                this.hideAllActionMenus();
            }
        });

        // Close modal with escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.showPublishModal) {
                this.closePublishModal();
            }
        });
    },
    beforeDestroy() {
        // Clean up event listeners
        document.removeEventListener('click', e => {
            if (this.currentCommentingFeed &&
                !e.target.closest('.comment-input-container') &&
                !e.target.closest('.action-item')) {
                this.currentCommentingFeed = null;
            }

            if (!e.target.closest('.feed-actions-dropdown')) {
                this.hideAllActionMenus();
            }
        });

        document.removeEventListener('keydown', e => {
            if (e.key === 'Escape' && this.showPublishModal) {
                this.closePublishModal();
            }
        });
    }
};
</script>

<style scoped>
/* Add modal styles */
.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
}

.publish-modal {
    width: 100%;
    max-width: 600px;
    max-height: 80vh;
    margin-left: 60px;
    background-color: white;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.publish-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px;
    border-bottom: 1px solid #e0e0e0;
}

.publish-header h2 {
    margin: 0;
    font-size: 18px;
}

.publish-header .actions {
    display: flex;
    gap: 10px;
}

.cancel-btn {
    padding: 6px 12px;
    border: 1px solid #e0e0e0;
    background: white;
    border-radius: 4px;
    cursor: pointer;
}

.publish-btn {
    padding: 6px 12px;
    border: none;
    background-color: #3F64E4;
    color: white;
    border-radius: 4px;
    cursor: pointer;
}

.publish-btn:disabled {
    background-color: #e0e0e0;
    cursor: not-allowed;
}

.publish-content {
    flex: 1;
    padding: 16px;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
}

.text-input-container {
    margin-bottom: 16px;
}

.text-input {
    width: 100%;
    min-height: 100px;
    border: none;
    resize: none;
    font-size: 16px;
    line-height: 1.5;
    padding: 0;
    outline: none;
    font-family: inherit;
}

.media-preview {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin-bottom: 16px;
}

.media-item-container {
    position: relative;
    padding-bottom: 100%; /* Square aspect ratio */
    height: 0;
}

.media-preview-item {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 4px;
}

.delete-media {
    position: absolute;
    top: -8px;
    right: -8px;
    width: 20px;
    height: 20px;
    background: rgba(0, 0, 0, 0.7);
    border-radius: 50%;
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;
    z-index: 1;
}

.delete-media i {
    color: white;
    font-size: 18px;
}

.add-media-btn {
    border: 1px dashed #ccc;
    border-radius: 4px;
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;
    padding-bottom: 100%; /* Square aspect ratio */
    height: 0;
    position: relative;
}

.add-media-btn i {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: #888;
    font-size: 24px;
}

.media-upload {
    margin-top: 16px;
}

.upload-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border: 1px solid #e0e0e0;
    background: white;
    border-radius: 4px;
    cursor: pointer;
}

.upload-btn i {
    color: #888;
    font-size: 18px;
}

/* Existing styles */
.comment-input-container {
    display: flex;
    margin-top: 8px;
    background-color: #f5f5f5;
    border-radius: 4px;
    padding: 4px 6px 4px 12px;
    align-items: center;
}

.comment-input {
    flex: 1;
    border: none;
    background: transparent;
    font-size: 14px;
    line-height: 28px;
    outline: none;
    color: #333;
}

.comment-submit-btn {
    border: none;
    background: #3F64E4;
    color: white;
    padding: 4px 12px;
    border-radius: 4px;
    font-size: 13px;
    cursor: pointer;
}

.comment-submit-btn:disabled {
    background: #868686;
    cursor: not-allowed;
}

.moments-container {
    max-width: 600px;
    margin: auto;
    width: 100%;
    height: 100%;
    position: relative;
    background-color: #f2f2f2;
    overflow: hidden;
}

/* Main scrollable container */
.scrollable-content {
    width: 100%;
    height: 100%;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    /* For smooth scrolling on iOS */
}

/* Header that scrolls with content */
.moments-header {
    position: relative;
    height: 240px;
    width: 100%;
    background-color: white;
}

.cover-image {
    height: 200px;
    width: 100%;
    overflow: hidden;
    position: relative;
}

.cover-background {
    width: 100%;
    height: 100%;
    background-color: #3F64E4;
    position: absolute;
    top: 0;
    left: 0;
}

.user-profile {
    position: absolute;
    right: 20px;
    bottom: 0;
    display: flex;
    align-items: center;
    z-index: 1;
}

.user-profile .avatar {
    width: 70px;
    height: 70px;
    border: 4px solid #fff;
    border-radius: 6px;
    margin-right: 10px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
}

.user-profile .nickname {
    font-size: 18px;
    font-weight: bold;
    color: #333;
    background-color: rgba(255, 255, 255, 0.7);
    padding: 5px 10px;
    border-radius: 4px;
}

/* Main content area */
.moments-content {
    background-color: #f2f2f2;
}

.feeds-list {
    height: 100%;
}

/* Custom spinner for infinite loading */
.custom-spinner {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 20px 0;
    color: #666;
}

.custom-spinner i {
    font-size: 24px;
    margin-bottom: 8px;
}

.rotating {
    animation: rotate 1s infinite linear;
}

@keyframes rotate {
    from {
        transform: rotate(0deg);
    }

    to {
        transform: rotate(360deg);
    }
}

/* Empty state styling */
.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 240px;
    padding: 20px;
    color: #999;
}

.empty-state i {
    font-size: 48px;
    margin-bottom: 20px;
}

.empty-state p {
    margin-bottom: 20px;
    font-size: 16px;
}

.empty-publish-btn {
    padding: 10px 20px;
    background-color: #3F64E4;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 16px;
    cursor: pointer;
}

/* Feed items styling */
.feed-item {
    background-color: white;
    padding: 16px;
    display: flex;
    position: relative;
    border-bottom: 1px solid #F3F3F3;
}

.feed-sender {
    margin-right: 10px;
    flex-shrink: 0;
}

.feed-sender .avatar {
    width: 44px;
    height: 44px;
    border-radius: 4px;
    object-fit: cover;
    cursor: pointer;
}

.feed-body {
    flex: 1;
    min-width: 0;
}

/* Updated sender name styling */
.sender-name {
    font-weight: bold;
    font-size: 16px;
    color: #576b95;
    margin-bottom: 8px;
    cursor: pointer;
}

.sender-name:hover {
    text-decoration: underline;
}

.feed-text {
    font-size: 15px;
    line-height: 1.5;
    margin: 0 0 12px;
    word-break: break-word;
}

/* WeChat-like media grid */
.feed-media-grid {
    display: grid;
    grid-gap: 6px;
    margin-bottom: 12px;
}

.grid-1 {
    grid-template-columns: minmax(0, 240px);
}

.grid-2 {
    grid-template-columns: repeat(2, 1fr);
}

.grid-3 {
    grid-template-columns: repeat(3, 1fr);
}

.grid-4 {
    grid-template-columns: repeat(2, 1fr);
    grid-template-rows: repeat(2, 1fr);
}

.grid-6 {
    grid-template-columns: repeat(3, 1fr);
    grid-template-rows: repeat(2, 1fr);
}

.grid-9 {
    grid-template-columns: repeat(3, 1fr);
    grid-template-rows: repeat(3, 1fr);
}

.media-wrapper {
    position: relative;
    padding-bottom: 100%;
    overflow: hidden;
}

.media-thumbnail {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    cursor: pointer;
}

/* Updated feed-meta styling to position timestamp and actions on the same line */
.feed-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin: 8px 0;
    font-size: 13px;
    color: #999;
    border-bottom: 1px solid #f3f3f3;
    padding-bottom: 10px;
}

.timestamp {
    font-size: 12px;
    color: #999;
}

/* Actions dropdown styling */
.feed-actions-dropdown {
    position: relative;
    /* display: flex;
    flex-direction: row; */
}

.actions-trigger {
    width: 36px;
    height: 24px;
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;
}

.actions-trigger i {
    font-size: 20px;
    color: #888;
}

.actions-menu {
    position: absolute;
    right: 0;
    background-color: #4c4c4c;
    border-radius: 4px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
    display: flex;
    overflow: hidden;
    z-index: 5;
}

.action-item {
    padding: 8px 12px;
    display: flex;
    align-items: center;
    color: white;
    cursor: pointer;
    min-width: 80px;
    justify-content: center;
}

.action-item i {
    margin-right: 4px;
    font-size: 16px;
    color: white;
}

.action-item:hover {
    background-color: #5c5c5c;
}

/* Reactions panel */
.reactions-panel {
    background-color: #f7f7f7;
    border-radius: 4px;
    margin-top: 10px;
    overflow: hidden;
}

.likes-area {
    display: flex;
    align-items: flex-start;
    padding: 8px 12px;
    border-bottom: 1px solid #ececec;
}

.likes-area i {
    color: #eb4e79;
    margin-right: 5px;
    font-size: 14px;
    margin-top: 3px;
}

.like-users {
    flex: 1;
    display: flex;
    flex-wrap: wrap;
}

.like-user {
    color: #576b95;
    cursor: pointer;
    font-size: 14px;
}

.like-user:hover {
    text-decoration: underline;
}

.comments-area {
    padding: 8px 12px;
}

.comment-item {
    margin-bottom: 8px;
    font-size: 14px;
    line-height: 1.4;
}

.comment-item:last-child {
    margin-bottom: 0;
}

.commenter-name {
    color: #576b95;
    font-weight: 500;
    cursor: pointer;
}

.commenter-name:hover {
    text-decoration: underline;
}

.comment-text {
    word-break: break-word;
}

/* Floating publish button */
.publish-fab {
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background-color: #3F64E4;
    color: white;
    display: flex;
    justify-content: center;
    align-items: center;
    box-shadow: 0 3px 10px rgba(0, 0, 0, 0.3);
    cursor: pointer;
    z-index: 10;
    transition: transform 0.2s;
}

.publish-fab i {
    font-size: 24px;
    color: white;
}

.publish-fab:hover {
    transform: scale(1.05);
}
</style>
