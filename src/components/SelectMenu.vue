<template>
    <div class="menu" v-if="!selected">
        <ul class="objects">
            <li
                v-for="(value, index) in elements"
                :key="index"
                @click="select(index)"
            >
                {{ value.name }}
            </li>
        </ul>
    </div>
    <div class="menu" v-else>
        <div class="menu-top">
            <a class="return" @click="unselect">&lt;</a>
            <span class="name">{{ selected.name }}</span>
        </div>
        <div></div>
    </div>
</template>

<script lang="ts" setup>
export interface SelectElement {
    name: string
}

export type SelectEvent = {
    element: SelectElement
    index: number
}

defineProps<{
    elements: SelectElement[]
}>()
defineEmits<{
    (e: "select", event: SelectEvent): void
    (e: "unselect"): void
}>()
</script>

<script lang="ts">
import { defineComponent, defineProps } from "vue"

export default defineComponent({
    components: {},
    data: () => ({
        selected: null as SelectElement | null,
    }),
    watch: {
        elements() {
            const selected = this.selected
            if (!selected) return

            if (!this.elements.some((el) => el.name === selected.name)) {
                this.unselect()
            }
        },
    },
    methods: {
        select(index: number) {
            this.selected = this.elements[index]
            this.$emit("select", { element: this.selected, index })
        },
        unselect() {
            this.selected = null
            this.$emit("unselect")
        },
    },
})
</script>

<style scoped>
.menu {
    width: 100%;
    background: var(--background-15);
    height: 100%;
    color: var(--white);

    max-height: 100%;
    overflow-y: scroll;
    word-wrap: break-word;
}
.objects {
    list-style-type: none;

    display: flex;
    flex-direction: column;
    margin: 0;
    padding: 0;

    user-select: none;
}
.objects > li {
    padding: 0.5em 1em;
    position: relative;
}

.objects > li:hover::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(255, 255, 255, 0.4);
    cursor: pointer;
}

.menu-top {
    display: flex;
    width: 100%;
    align-items: center;
    overflow: hidden;
}
.menu-top > .name {
    margin-left: 1em;
    width: calc(100% - 4.5em);
    word-wrap: break-word;
    flex-grow: 1;
}
.menu-top > .return {
    padding: 0.5em 1.25em;
    font-weight: 800;
    cursor: pointer;
}
</style>
