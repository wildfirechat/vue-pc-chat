<template>
    <section class="organization-tree-container">
        <div>
            <h2 class="title">
                组织结构
            </h2>
        </div>
        <nav class="breadcrumb">
            <ul>
                <li><a href="#">公司</a></li>
                <li><a href="#">一级部门</a></li>
                <li><a href="#">二级部门</a></li>
            </ul>
        </nav>
        <div class="member-list-container">
            部门成员列表，包含直接子部门和部门员工
        </div>
    </section>
</template>

<script>
import store from "@/store";
import Conversation from "@/wfc/model/conversation";
import ConversationType from "@/wfc/model/conversationType";

export default {
    name: "ChannelTreeView",
    props: {},
    data() {
        return {
            sharedContactState: store.state.contact,
        }
    },
    methods: {
    }

}
</script>

<style lang="css" scoped>

.organization-tree-container {
    display: flex;
    height: 100%;
    flex-direction: column;
    border-top-right-radius: var(--main-border-radius);
    border-bottom-right-radius: var(--main-border-radius);
}

.title {
    padding: 20px;
    font-size: 20px;
    border-bottom: 1px solid lightgray;
}

.breadcrumb {
    padding: 20px 0 20px 20px;
}

.breadcrumb ul {
    display: flex;
    flex-wrap: wrap;
    list-style: none;
    margin: 0;
    padding: 0;
}

.breadcrumb a {
    text-decoration: none;
}

.breadcrumb li:not(:last-child)::after {
    display: inline-block;
    margin: 0 10px;
    color: #8f959f;
    content: ">";
}

.breadcrumb li:not(:last-child) a {
    color: #4168e0;
}

.breadcrumb li:last-child a {
    color: #8f959f;
}

.member-list-container {
    margin: 5px 20px 20px 20px;
    flex: 1;
}

</style>
