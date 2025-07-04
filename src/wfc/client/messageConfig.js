/*
 * Copyright (c) 2020 WildFireChat. All rights reserved.
 */

import TextMessageContent from '../messages/textMessageContent'
import PTextMessageContent from '../messages/ptextMessageContent'
import ImageMessageContent from '../messages/imageMessageContent';

import MessageContentType from '../messages/messageContentType';

import PersistFlag from '../messages/persistFlag';
import TipNotificationMessageContent from '../messages/notification/tipNotification';
import UnknownMessageContent from '../messages/unknownMessageContent';
import UnsupportMessageContent from '../messages/unsupportMessageConten';
import ChangeGroupNameNotification from '../messages/notification/changeGroupNameNotification';
import KickoffGroupMemberNotification from '../messages/notification/kickoffGroupMemberNotification';
import KickoffGroupMemberVisiableNotification from '../messages/notification/kickoffGroupMemberVisiableNotification';
import AddGroupMemberNotification from '../messages/notification/addGroupMemberNotification';
import ChangeGroupPortraitNotification from '../messages/notification/changeGroupPortraitNotification';
import CreateGroupNotification from '../messages/notification/createGroupNotification';
import DismissGroupNotification from '../messages/notification/dismissGroupNotification';
import ModifyGroupAliasNotification from '../messages/notification/modifyGroupAliasNotification';
import ModifyGroupExtraNotification from '../messages/notification/modifyGroupExtraNotification';
import ModifyGroupMemberExtraNotification from '../messages/notification/modifyGroupMemberExtraNotification';
import QuitGroupNotification from '../messages/notification/quitGroupNotification';
import QuitGroupVisiableNotification from '../messages/notification/quitGroupVisiableNotification';
import TransferGroupOwnerNotification from '../messages/notification/transferGroupOwnerNotification';
import FileMessageContent from '../messages/fileMessageContent';
import VideoMessageContent from '../messages/videoMessageContent';
import StickerMessageContent from '../messages/stickerMessageContent';
import SoundMessageContent from '../messages/soundMessageContent';
import TypingMessageContent from '../messages/typingMessageContent';
import RecallMessageNotification from '../messages/notification/recallMessageNotification';
import DeleteMessageContent from '../messages/deleteMessageContent';

import CallStartMessageContent from '../av/messages/callStartMessageContent';
import CallAnswerMessageContent from '../av/messages/callAnswerMessageContent';
import CallAnswerTMessageContent from '../av/messages/callAnswerTMessageContent';
import CallByeMessageContent from '../av/messages/callByeMessageContent';
import CallSignalMessageContent from '../av/messages/callSignalMessageContent';
import CallModifyMessageContent from '../av/messages/callModifyMessageContent';
import AddParticipantsMessageContent from "../av/messages/addParticipantsMessageContent";
import MuteVideoMessageContent from "../av/messages/muteVideoMessageContent";
import GroupJoinTypeNotificationContent from "../messages/notification/groupJoinTypeNotificationContent";
import GroupMuteNotificationContent from "../messages/notification/groupMuteNotificationContent";
import GroupSetManagerNotificationContent from "../messages/notification/groupSetManagerNotificationContent";
import GroupPrivateChatNotificationContent from "../messages/notification/groupPrivateChatNotificationContent";
import LocationMessageContent from "../messages/locationMessageContent";
import MuteGroupMemberNotification from '../messages/notification/muteGroupMemberNotification'
import AllowGroupMemberNotification from '../messages/notification/allowGroupMemberNotification'
import CardMessageContent from '../messages/cardMessageContent'
import CompositeMessageContent from "../messages/compositeMessageContent";
import ConferenceInviteMessageContent from "../av/messages/conferenceInviteMessageContent";
import ConferenceChangeModeContent from "../av/messages/conferenceChangeModeContent";
import ConferenceKickoffMemberMessageContent from "../av/messages/conferenceKickoffMemberMessageContent";
import MarkUnreadMessageContent from "../messages/markUnreadMessageContent";
import LinkMessageContent from "../messages/linkMessageContent";
import FriendAddedNotification from "../messages/notification/friendAddedNotification";
import FriendGreetingNotification from "../messages/notification/friendGreetingNotification";
import StartSecretChatNotification from "../messages/notification/startSecretChatNotification";
import MultiCallOngoingMessageContent from "../av/messages/multiCallOngoingMessageContent";
import JoinCallRequestMessageContent from "../av/messages/joinCallRequestMessageContent";
import RichNotificationMessageContent from "../messages/notification/richNotificationMessageContent";
import ArticlesMessageContent from "../messages/articlesMessageContent";
import ConferenceCommandMessageContent from "../av/messages/conferenceCommandMessageContent";
import ChannelMenuEventMessageContent from "../messages/channelMenuEventMessageContent";
import EnterChannelChatMessageContent from "../messages/enterChannelChatMessageContent";
import LeaveChannelChatMessageContent from "../messages/leaveChannelChatMessageContent";
import ModifyGroupSettingNotification from "../messages/notification/modifyGroupSettingNotification";
import StreamingTextGeneratingMessageContent from "../messages/streamingTextGeneratingMessageContent";
import StreamingTextGeneratedMessageContent from "../messages/streamingTextGeneratedMessageContent";
import MixMultiMediaTextMessageContent from "../messages/mixMultiMediaTextMessageContent";
import MixFileTextMessageContent from "../messages/mixFileTextMessageContent";
import RCInviteMessageContent from "../av/messages/rcInviteMessageContent";
import RcAcceptInviteMessageContent from "../av/messages/rcAcceptInviteMessageContent";
import RcEndMessageContent from "../av/messages/rcEndMessageContent";
import RcRequestMessageContent from "../av/messages/rcRequestMessageContent";
import GroupRejectJoinNotificationContent from "../messages/notification/groupRejectJoinNotificationContent";

export default class MessageConfig {
    static getMessageContentClazz(type) {
        for (const content of MessageConfig.MessageContents) {
            if (content.type === type) {
                if (content.contentClazz) {
                    return content.contentClazz;
                } else {
                    return UnsupportMessageContent;
                }
            }
        }
        console.error(`message type ${type} is unknown`);
        return UnknownMessageContent;
    }

    static getMessageContentFlag(type) {
        let flag = PersistFlag.No_Persist;
        for (const content of MessageConfig.MessageContents) {
            if (content.type === type) {
                flag = content.flag;
            }
        }
        return flag;
    }

    static getMessageContentPersitFlag(type) {
        for (const content of MessageConfig.MessageContents) {
            if (content.type === type) {
                return content.flag;
            }
        }
        return -1;
    }

    static getMessageContentType(messageContent) {
        for (const content of MessageConfig.MessageContents) {
            if (content.contentClazz && messageContent instanceof content.contentClazz) {
                return content.type;
            }
        }

        return MessageContentType.Unknown;
    }

    static registerMessageContent(name, flag, type, clazz) {
        // TODO validate args

        MessageConfig.MessageContents.push(
            {
                name: name,
                flag: flag,
                type: type,
                contentClazz: clazz,
            }
        );

    }

    static MessageContents = [
        {
            name: 'unknown',
            flag: PersistFlag.Persist,
            type: MessageContentType.Unknown,
            contentClazz: UnknownMessageContent,
        },
        {
            name: 'text',
            flag: PersistFlag.Persist_And_Count,
            type: MessageContentType.Text,
            contentClazz: TextMessageContent,
        },
        {
            name: 'ptext',
            flag: PersistFlag.Persist,
            type: MessageContentType.P_Text,
            contentClazz: PTextMessageContent,
        },
        {
            name: 'voice',
            flag: PersistFlag.Persist_And_Count,
            type: MessageContentType.Voice,
            contentClazz: SoundMessageContent,
        },
        {
            name: 'image',
            flag: PersistFlag.Persist_And_Count,
            type: MessageContentType.Image,
            contentClazz: ImageMessageContent,
        },
        {
            name: 'location',
            flag: PersistFlag.Persist_And_Count,
            type: MessageContentType.Location,
            contentClazz: LocationMessageContent,
        },
        {
            name: 'file',
            flag: PersistFlag.Persist_And_Count,
            type: MessageContentType.File,
            contentClazz: FileMessageContent,
        },
        {
            name: 'video',
            flag: PersistFlag.Persist_And_Count,
            type: MessageContentType.Video,
            contentClazz: VideoMessageContent,
        },
        {
            name: 'sticker',
            flag: PersistFlag.Persist_And_Count,
            type: MessageContentType.Sticker,
            contentClazz: StickerMessageContent,
        },
        {
            name: 'link',
            flag: PersistFlag.Persist_And_Count,
            type: MessageContentType.Link,
            contentClazz: LinkMessageContent,
        },
        {
            name: 'userCard',
            flag: PersistFlag.Persist_And_Count,
            type: MessageContentType.UserCard,
            contentClazz: CardMessageContent,
        },
        {
            name: 'compositeMessage',
            flag: PersistFlag.Persist_And_Count,
            type: MessageContentType.Composite_Message,
            contentClazz: CompositeMessageContent,
        },
        {
            name: 'tip',
            flag: PersistFlag.Persist,
            type: MessageContentType.Tip_Notification,
            contentClazz: TipNotificationMessageContent,
        },
        {
            name: 'typing',
            flag: PersistFlag.Transparent,
            type: MessageContentType.Typing,
            contentClazz: TypingMessageContent,
        },
        {
            name: 'friendGreeting',
            flag: PersistFlag.Persist,
            type: MessageContentType.Friend_Added,
            contentClazz: FriendGreetingNotification,
        },
        {
            name: 'friendAdded',
            flag: PersistFlag.Persist,
            type: MessageContentType.Friend_Greeting,
            contentClazz: FriendAddedNotification,
        },
        {
            name: 'addGroupMemberNotification',
            flag: PersistFlag.Persist,
            type: MessageContentType.AddGroupMember_Notification,
            contentClazz: AddGroupMemberNotification,
        },
        {
            name: 'changeGroupNameNotification',
            flag: PersistFlag.Persist,
            type: MessageContentType.ChangeGroupName_Notification,
            contentClazz: ChangeGroupNameNotification,
        },
        {
            name: 'changeGroupPortraitNotification',
            flag: PersistFlag.Persist,
            type: MessageContentType.ChangeGroupPortrait_Notification,
            contentClazz: ChangeGroupPortraitNotification,
        },
        {
            name: 'createGroupNotification',
            flag: PersistFlag.Persist,
            type: MessageContentType.CreateGroup_Notification,
            contentClazz: CreateGroupNotification,
        },
        {
            name: 'dismissGroupNotification',
            flag: PersistFlag.Persist,
            type: MessageContentType.DismissGroup_Notification,
            contentClazz: DismissGroupNotification,
        },
        {
            name: 'kickoffGroupMemberNotification',
            flag: PersistFlag.Persist,
            type: MessageContentType.KickOffGroupMember_Notification,
            contentClazz: KickoffGroupMemberNotification,
        },
        {
            name: 'kickoffGroupMemberVisiableNotification',
            flag: PersistFlag.Persist,
            type: MessageContentType.KickOffGroupMember_Visible_Notification,
            contentClazz: KickoffGroupMemberVisiableNotification,
        },
        {
            name: 'modifyGroupAliasNotification',
            flag: PersistFlag.Persist,
            type: MessageContentType.ModifyGroupAlias_Notification,
            contentClazz: ModifyGroupAliasNotification,
        },
        {
            name: 'modifyGroupExtraNotification',
            flag: PersistFlag.Persist,
            type: MessageContentType.ModifyGroupExtra_Notification,
            contentClazz: ModifyGroupExtraNotification,
        },
        {
            name: 'modifyGroupMemberExtraNotification',
            flag: PersistFlag.Persist,
            type: MessageContentType.ModifyGroupMemberExtra_Notification,
            contentClazz: ModifyGroupMemberExtraNotification,
        },
        {
            name: 'quitGroupNotification',
            flag: PersistFlag.Persist,
            type: MessageContentType.QuitGroup_Notification,
            contentClazz: QuitGroupNotification,
        },
        {
            name: 'quitGroupVisiableNotification',
            flag: PersistFlag.Persist,
            type: MessageContentType.QuitGroup_Visible_Notification,
            contentClazz: QuitGroupVisiableNotification,
        },
        {
            name: 'transferGroupOwnerNotification',
            flag: PersistFlag.Persist,
            type: MessageContentType.TransferGroupOwner_Notification,
            contentClazz: TransferGroupOwnerNotification,
        },
        {
            name: 'groupJoinTypeNotificationContent',
            flag: PersistFlag.Persist,
            type: MessageContentType.ChangeJoinType_Notification,
            contentClazz: GroupJoinTypeNotificationContent,
        },
        {
            name: 'groupMuteNotificationContent',
            flag: PersistFlag.Persist,
            type: MessageContentType.MuteGroup_Notification,
            contentClazz: GroupMuteNotificationContent,
        },
        {
            name: 'groupPrivateChatNotificationContent',
            flag: PersistFlag.Persist,
            type: MessageContentType.ChangePrivateChat_Notification,
            contentClazz: GroupPrivateChatNotificationContent,
        },
        {
            name: 'groupSetManagerNotificationContent',
            flag: PersistFlag.Persist,
            type: MessageContentType.SetGroupManager_Notification,
            contentClazz: GroupSetManagerNotificationContent,
        },
        {
            name: 'muteGroupMemberNotificationContent',
            flag: PersistFlag.Persist,
            type: MessageContentType.MuteGroupMember_Notification,
            contentClazz: MuteGroupMemberNotification,
        },
        {
            name: 'allowGroupMemberNotificationContent',
            flag: PersistFlag.Persist,
            type: MessageContentType.AllowGroupMember_Notification,
            contentClazz: AllowGroupMemberNotification,
        },
        {
            name: 'modifyGroupSettingNotificationContent',
            flag: PersistFlag.No_Persist,
            type: MessageContentType.ModifyGroupSetting_Notification,
            contentClazz: ModifyGroupSettingNotification,
        },
        {
            name: 'groupRejectJoinNotificationContent',
            flag: PersistFlag.Persist,
            type: MessageContentType.RejectJoinGroup,
            contentClazz: GroupRejectJoinNotificationContent,
        },
        {
            name: 'recall',
            flag: PersistFlag.Persist,
            type: MessageContentType.RecallMessage_Notification,
            contentClazz: RecallMessageNotification,
        },
        {
            name: 'delete',
            flag: PersistFlag.No_Persist,
            type: MessageContentType.DeleteMessage_Notification,
            contentClazz: DeleteMessageContent,
        },
        {
            name: 'streamingTextGenerating',
            flag: PersistFlag.Transparent,
            type: MessageContentType.Streaming_Text_Generating,
            contentClazz: StreamingTextGeneratingMessageContent,
        },
        {
            name: 'streamingTextGenerated',
            flag: PersistFlag.Persist_And_Count,
            type: MessageContentType.Streaming_Text_Generated,
            contentClazz: StreamingTextGeneratedMessageContent,
        },
        {
            name: 'callStartMessageContent',
            flag: PersistFlag.Persist,
            type: MessageContentType.VOIP_CONTENT_TYPE_START,
            contentClazz: CallStartMessageContent,
        },
        {
            name: 'callAnswerMessageContent',
            flag: PersistFlag.No_Persist,
            type: MessageContentType.VOIP_CONTENT_TYPE_ACCEPT,
            contentClazz: CallAnswerMessageContent,
        },
        {
            name: 'callAnswerTMessageContent',
            flag: PersistFlag.Transparent,
            type: MessageContentType.VOIP_CONTENT_TYPE_ACCEPT_T,
            contentClazz: CallAnswerTMessageContent,
        },
        {
            name: 'callByeMessageContent',
            flag: PersistFlag.No_Persist,
            type: MessageContentType.VOIP_CONTENT_TYPE_END,
            contentClazz: CallByeMessageContent,
        },
        {
            name: 'callSignalMessageContent',
            flag: PersistFlag.Transparent,
            type: MessageContentType.VOIP_CONTENT_TYPE_SIGNAL,
            contentClazz: CallSignalMessageContent,
        },
        {
            name: 'callModifyMessageContent',
            flag: PersistFlag.No_Persist,
            type: MessageContentType.VOIP_CONTENT_TYPE_MODIFY,
            contentClazz: CallModifyMessageContent,
        },
        {
            name: 'callAddParticipant',
            flag: PersistFlag.Persist,
            type: MessageContentType.VOIP_CONTENT_TYPE_ADD_PARTICIPANT,
            contentClazz: AddParticipantsMessageContent,
        },
        {
            name: 'callMuteVideo',
            flag: PersistFlag.No_Persist,
            type: MessageContentType.VOIP_CONTENT_TYPE_MUTE_VIDEO,
            contentClazz: MuteVideoMessageContent,
        },
        {
            name: 'conferenceInvite',
            flag: PersistFlag.Persist_And_Count,
            type: MessageContentType.CONFERENCE_CONTENT_TYPE_INVITE,
            contentClazz: ConferenceInviteMessageContent,
        },
        {
            name: 'conferenceChangeMode',
            flag: PersistFlag.Transparent,
            type: MessageContentType.CONFERENCE_CONTENT_TYPE_CHANGE_MODE,
            contentClazz: ConferenceChangeModeContent,
        },
        {
            name: 'conferenceKickoffMember',
            flag: PersistFlag.Transparent,
            type: MessageContentType.CONFERENCE_CONTENT_TYPE_KICKOFF_MEMBER,
            contentClazz: ConferenceKickoffMemberMessageContent,
        },
        {
            name: 'multiCallOngoing',
            flag: PersistFlag.Transparent,
            type: MessageContentType.VOIP_Multi_Call_Ongoing,
            contentClazz: MultiCallOngoingMessageContent,
        },
        {
            name: 'joinCallRequest',
            flag: PersistFlag.Transparent,
            type: MessageContentType.VOIP_Join_Call_Request,
            contentClazz: JoinCallRequestMessageContent,
        },
        {
            name: 'rcInviteMessageContent',
            flag: PersistFlag.No_Persist,
            type: MessageContentType.VOIP_REMOTE_CONTROL_INVITE,
            contentClazz: RCInviteMessageContent,
        },
        {
            name: 'rcAcceptInviteMessageContent',
            flag: PersistFlag.No_Persist,
            type: MessageContentType.VOIP_REMOTE_CONTROL_ACCEPT_INVITE,
            contentClazz: RcAcceptInviteMessageContent,
        },
        {
            name: 'rcRequestMessageContent',
            flag: PersistFlag.No_Persist,
            type: MessageContentType.VOIP_REMOTE_CONTROL_REQUEST,
            contentClazz: RcRequestMessageContent,
        },
        {
            name: 'rcEndMessageContent',
            flag: PersistFlag.No_Persist,
            type: MessageContentType.VOIP_REMOTE_CONTROL_END,
            contentClazz: RcEndMessageContent,
        },
        {
            name: 'markUnreadMessage',
            flag: PersistFlag.No_Persist,
            type: MessageContentType.Mark_Unread_Sync,
            contentClazz: MarkUnreadMessageContent,
        },
        {
            name: 'startSecretChat',
            flag: PersistFlag.Persist_And_Count,
            type: MessageContentType.StartSecretChat_Notification,
            contentClazz: StartSecretChatNotification,
        },
        {
            name: 'richNotification',
            flag: PersistFlag.Persist_And_Count,
            type: MessageContentType.Rich_Notification,
            contentClazz: RichNotificationMessageContent,
        },
        {
            name: 'articlesMessageContent',
            flag: PersistFlag.Persist_And_Count,
            type: MessageContentType.Articles,
            contentClazz: ArticlesMessageContent,
        },
        {
            name: 'channelMenuEventMessageContent',
            flag: PersistFlag.Transparent,
            type: MessageContentType.Channel_Menu_Event,
            contentClazz: ChannelMenuEventMessageContent,
        },
        {
            name: 'enterChannelChatMessageContent',
            flag: PersistFlag.Transparent,
            type: MessageContentType.Enter_Channel_Chat,
            contentClazz: EnterChannelChatMessageContent,
        },
        {
            name: 'leaveChannelChatMessageContent',
            flag: PersistFlag.Transparent,
            type: MessageContentType.Leave_Channel_Chat,
            contentClazz: LeaveChannelChatMessageContent,
        },
        {
            name: 'conferenceCommandMessageContent',
            flag: PersistFlag.Transparent,
            type: MessageContentType.CONFERENCE_CONTENT_TYPE_COMMAND,
            contentClazz: ConferenceCommandMessageContent,
        },
        {
            name: 'mixMediaTextMessageContent',
            flag: PersistFlag.Persist_And_Count,
            type: MessageContentType.MESSAGE_CONTENT_TYPE_MIX_FILE_TEXT,
            contentClazz: MixFileTextMessageContent,
        },
        {
            name: 'mixMultiMediaTextMessageContent',
            flag: PersistFlag.Persist_And_Count,
            type: MessageContentType.MESSAGE_CONTENT_TYPE_MIX_MULTI_MEDIA_TEXT,
            contentClazz: MixMultiMediaTextMessageContent,
        }

    ];
}
