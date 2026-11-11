// 路由页面按需加载：每个窗口只加载、执行自己用到的页面代码。
// 设置、聊天记录等子窗口原来要把会话、通话、会议等全部页面的代码都跑一遍，打开时白屏时间长。
// 主界面的几个 tab 同属一个 chunk，进主界面时一次加载
const HomePage = () => import(/* webpackChunkName: "home" */ './ui/main/HomePage');
const LoginPage = () => import(/* webpackChunkName: "login" */ './ui/main/LoginPage');
const ConversationPage = () => import(/* webpackChunkName: "home" */ './ui/main/ConversationPage');
const ContactPage = () => import(/* webpackChunkName: "home" */ './ui/main/ContactPage');
const SettingPage = () => import(/* webpackChunkName: "setting" */ './ui/main/setting/SettingPage');
const Single = () => import(/* webpackChunkName: "voip-single" */ './ui/voip/Single');
const Multi = () => import(/* webpackChunkName: "voip-multi" */ './ui/voip/Multi');
const FileRecordPage = () => import(/* webpackChunkName: "files" */ './ui/fileRecord/FileRecordPage');
const FavPage = () => import(/* webpackChunkName: "home" */ './ui/main/fav/FavPage');
const WorkspacePage = () => import(/* webpackChunkName: "workspace" */ './ui/workspace/WorkspacePage');
const Conference = () => import(/* webpackChunkName: "voip-conference" */ './ui/voip/conference/Conference');
const CompositeMessagePage = () => import(/* webpackChunkName: "composite" */ './ui/main/CompositeMessagePage');
const MessageHistoryPage = () => import(/* webpackChunkName: "message-history" */ './ui/main/MessageHistoryPage');
const ConversationMessageHistoryPage = () => import(/* webpackChunkName: "conversation-message-history" */ './ui/main/ConversationMessageHistoryPage');
const ConversationMessageSearchPage = () => import(/* webpackChunkName: "conversation-search" */ './ui/main/search/ConversationMessageSearchPage');
const MessageContextPage = () => import(/* webpackChunkName: "message-context" */ './ui/main/search/MessageContextPage');
const ConversationFloatPage = () => import(/* webpackChunkName: "conversation-window" */ './ui/main/ConversationFloatPage');
const ConferencePortalPage = () => import(/* webpackChunkName: "home" */ './ui/voip/conference/ConferencePortalPage');
const MessagePage = () => import(/* webpackChunkName: "message" */ './ui/main/MessagePage.vue');
const MultimediaPreviewPage = () => import(/* webpackChunkName: "mmpreview" */ './ui/main/MultimediaPreviewPage.vue');
const SingleRemoteControl = () => import(/* webpackChunkName: "voip-single-rc" */ './ui/voip/SingleRemoteControl.vue');
const AI = () => import(/* webpackChunkName: "home" */ './ui/main/AI.vue');

const routers = [
    {
        path: '/',
        component: LoginPage
    },
    {
        path: '/home',
        component: HomePage,
        children: [
            {
                path: '',
                name: 'conversation',
                component: ConversationPage,
            },
            {
                path: 'contact',
                name: 'contact',
                component: ContactPage,
            },
            {
                path: 'fav',
                name: 'fav',
                component: FavPage,
            },
            {
                name: 'h-wp',
                path: 'h-wp',
                component: WorkspacePage,
            },
            {
                path: 'setting',
                name: 'setting',
                component: SettingPage,
            },
            {
                path: 'conference',
                name: 'conference',
                component: ConferencePortalPage,
            },
            {
                path: 'ai',
                name: 'AI',
                component: AI,
            }
        ]
    },
    {
        name: 'voip-single',
        path: '/voip/single',
        component: Single,
    },
    {
        name: 'voip-single-rc',
        path: '/voip/single-rc',
        component: SingleRemoteControl,
    },
    {
        name: 'voip-multi',
        path: '/voip/multi',
        component: Multi,
    },
    {
        name: 'voip-conference',
        path: '/voip/conference',
        component: Conference,
    },
    {
        name: 'files',
        path: '/files',
        component: FileRecordPage,
    },
    {
        name: 'workspace',
        path: '/workspace',
        component: WorkspacePage,
    },
    {
        name: 'composite-message',
        path: '/composite',
        component: CompositeMessagePage,
    },
    {
        name: 'message',
        path: '/message',
        component: MessagePage,
    },
    {
        name: 'mmpreview',
        path: '/mmpreview',
        component: MultimediaPreviewPage,
    },
    {
        name: 'message-history',
        path: '/message-history',
        component: MessageHistoryPage,
    },
    {
        // PC 设置独立窗口（侧栏「更多」→ 设置）；网页版仍是主界面里的 /home/setting
        name: 'setting-window',
        path: '/setting',
        component: SettingPage,
    },
    {
        name: 'conversation-message-history',
        path: '/conversation-message-history',
        component: ConversationMessageHistoryPage,
    },
    {
        name: 'conversation-window',
        path: '/conversation-window',
        component: ConversationFloatPage,
    },
    {
        name: 'conversation-search',
        path: '/conversation-search',
        component: ConversationMessageSearchPage,
    },
    {
        name: 'message-context',
        path: '/message-context',
        component: MessageContextPage,
    },
]
export default routers
