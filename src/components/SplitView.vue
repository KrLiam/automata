<template>
    <div
        class="container"
        ref="container"
        :style="{ 'flex-direction': containerDirection }"
    >
        <div class="left" :style="leftStyle" ref="left">
            <slot name="left"></slot>
        </div>
        <div
            class="separator"
            ref="separator"
            :style="separatorStyle"
            @mousedown="mouseDown"
        ></div>
        <div class="right" ref="right" :style="rightStyle">
            <slot name="right"></slot>
        </div>
    </div>
</template>

<script lang="ts" setup>
withDefaults(
    defineProps<{
        direction: "horizontal" | "vertical"
        pixels?: boolean
        initial?: number | null
        min_left?: number
        min_right?: number
        separator_size?: number
    }>(),
    {
        pixels: false,
        initial: null,
        min_left: 0.001,
        min_right: 0,
        separator_size: 15,
    },
)
</script>

<script lang="ts">
import { defineComponent, defineProps } from "vue"

export default defineComponent({
    data() {
        return {
            split: this.initial,
            minLeft: this.min_left,
            minRight: this.min_right,

            clickPos: 0,
            clickSize: 0,

            moveHandler: this.mouseMove.bind(this),
            upHandler: this.mouseUp.bind(this),

            container: {} as HTMLDivElement,
            left: {} as HTMLDivElement,
            right: {} as HTMLDivElement,
            separator: {} as HTMLDivElement,
        }
    },
    computed: {
        leftStyle() {
            return this.direction === "horizontal"
                ? { width: this.leftSize }
                : { height: this.leftSize }
        },
        rightStyle() {
            return this.direction === "horizontal"
                ? { width: this.rightSize }
                : { height: this.rightSize }
        },
        separatorStyle() {
            return this.direction === "horizontal"
                ? { width: this.separatorSize, cursor: "ew-resize" }
                : { height: this.separatorSize, cursor: "ns-resize" }
        },
        containerDirection() {
            return this.direction === "horizontal" ? "row" : "column"
        },

        leftSize() {
            if (!this.split) return "50%"

            if (this.pixels) {
                return `${this.split}px`
            }
            return `${this.split}%`
        },
        rightSize() {
            if (!this.split) return `calc(50% - ${this.separator_size}px)`

            if (this.pixels) {
                return "auto"
            }
            return `calc(${100 - this.split}% - ${this.separator_size}px)`
        },
        separatorSize() {
            return `${this.separator_size}px`
        },
    },
    mounted() {
        this.container = this.$refs.container as HTMLDivElement
        this.left = this.$refs.left as HTMLDivElement
        this.right = this.$refs.right as HTMLDivElement
        this.separator = this.$refs.separator as HTMLDivElement

        window.addEventListener("load", () => {
            const rect = this.container.getBoundingClientRect()
            const value = this.direction === "horizontal" ? rect.width : rect.height

            if (!this.split) this.split = this.pixels ? value / 2 : 50
        })
    },
    methods: {
        mouseDown(ev: MouseEvent) {
            // Get the current mouse position
            this.clickPos = this.direction === "horizontal" ? ev.clientX : ev.clientY

            const rect = this.left.getBoundingClientRect()
            this.clickSize =
                this.direction === "horizontal" ? rect.width : rect.height

            // Attach the listeners to `document`
            document.addEventListener("mousemove", this.moveHandler)
            document.addEventListener("mouseup", this.upHandler)
        },
        mouseMove(ev: MouseEvent) {
            const rect = this.container.getBoundingClientRect()
            const container_size =
                this.direction === "horizontal" ? rect.width : rect.height

            const mouse_pos =
                this.direction === "horizontal" ? ev.clientX : ev.clientY
            const delta = mouse_pos - this.clickPos

            let value: number
            if (this.pixels) {
                value = this.clickSize + delta
            } else {
                value = ((this.clickSize + delta) / container_size) * 100
            }

            const separator_percent = this.separator_size / container_size
            const max_split = this.pixels
                ? container_size - this.minRight
                : 100 - separator_percent - this.minRight
            this.split = Math.min(max_split, Math.max(value, this.minLeft))

            const cursor =
                this.direction === "horizontal" ? "col-resize" : "row-resize"
            document.body.style.cursor = cursor

            this.container.style.userSelect = "none"
            this.container.style.pointerEvents = "none"
        },
        mouseUp() {
            document.body.style.removeProperty("cursor")

            this.container.style.removeProperty("user-select")
            this.container.style.removeProperty("pointer-events")

            document.removeEventListener("mousemove", this.moveHandler)
            document.removeEventListener("mouseup", this.upHandler)
        },
    },
})
</script>

<style scoped>
.container {
    display: flex;
    width: 100%;
    max-width: 100%;
    height: 100%;
    max-height: 100%;
    overflow: hidden;
    padding: 0;
    margin: 0;
}
.container > .left {
    width: 100%;
    height: 100%;
}
.container > .right {
    flex-grow: 1;
    width: 100%;
    height: 100%;
}
.container > .separator {
    flex-grow: 0;
}
</style>
