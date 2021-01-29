import HomePage from './ui/main/HomePage'
import LoginPage from './ui/main/LoginPage'
import ConversationPage from './ui/main/ConversationPage'
import ContactPage from './ui/main/ContactPage'
import SettingPage from './ui/main/SettingPage'
import Single from "@/ui/voip/Single";
import Multi from "@/ui/voip/Multi";
import FileRecordPage from "@/ui/main/FileRecordPage";

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
                path: '/',
                name: 'conversation',
                component: ConversationPage,
            },
            {
                path: 'contact',
                name: 'contact',
                component: ContactPage,
            },
            {
                path: 'setting',
                name: 'setting',
                component: SettingPage,
            },
            {
                path: 'files',
                name: 'files',
                component: FileRecordPage,
            }
        ]
    },
    {
        name: 'voip-single',
        path: '/voip/single',
        component: Single,
    },
    {
        name: 'voip-multi',
        path: '/voip/multi',
        component: Multi,
    },
    // {
    //     name: 'voip-conference',
    //     path: '/voip/conference',
    //     component: Conference,
    // },

]
export default routers
