<template>
    <ul class="objects">
        <li
            v-for="(value, index) in elements"
            :key="index"
            :class="[value.name === selected ? 'selected' : '']"
            @click="click(index)"
        >
            {{ value.name }}
        </li>
    </ul>
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
    selected: string | null
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
    methods: {
        click(index: number) {
            const element = this.elements[index]

            if (element.name === this.selected) this.unselect()
            else this.select(index)
        },
        select(index: number) {
            const element = this.elements[index]
            this.$emit("select", { element, index })
        },
        unselect() {
            this.$emit("unselect")
        },
    },
})
</script>

<style scoped>
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
</style>
