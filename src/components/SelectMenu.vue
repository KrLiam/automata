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
export interface SelectElement<T> {
    name: string
    value: T
}

export type SelectEvent = {
    element: SelectElement<any>
    index: number
}

defineProps<{
    elements: SelectElement<any>[]
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
        selected: null as SelectElement<any> | null,
    }),
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
}
.objects > li:hover {
    background: var(--background-20);
    cursor: pointer;
}

.menu-top {
    display: flex;
    align-items: center;
    gap: 0.5em;
}
.menu-top > .return {
    padding: 0.5em 1.25em;
    font-weight: 800;
    cursor: pointer;
}
</style>
