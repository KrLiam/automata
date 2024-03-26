<template>
    <form
        class="test-input"
        @submit="submit"
        v-if="inserting_input"
    >
        <input
            type="text"
            placeholder="Input"
            v-model="input"
            v-focus
        />
        <button type="submit">Go</button>
    </form>
    <button @click="insert_input" v-else>
        Test Input
    </button>
</template>

<script lang="ts" setup>
defineEmits<{
    (e: "submit", input: string): void
}>()

</script>

<script lang="ts">
import { defineComponent } from 'vue';

export default defineComponent({
    directives: {
        focus(el) {
            el?.focus()
        },
    },
    data: () => ({
        inserting_input: false,
        input: "",
    }),
    methods: {
        insert_input() {
            this.inserting_input = true
        },
        clear_input() {
            this.inserting_input = false
            this.input = ""
        },
        submit() {
            const input = this.input
            this.clear_input()

            this.$emit("submit", input)
        },
    }
})
</script>

<style scoped>
.test-input {
    display: flex;
    gap: 0.5rem;
    width: 100%;
    height: 2.33rem;
}
.test-input > button {
    flex-shrink: 0;
    width: 4rem;
    padding: 0;
    text-align: center;
    line-height: 50%;
}
.test-input > input {
    width: 100%;
    flex-grow: 1;
    flex-shrink: 1;

    outline: none;
    border: none;
    border-radius: 0.2rem;
    background: var(--light-gray);
}
.test-input > input:focus {
    outline: 0.15rem solid var(--detail-green);
}
</style>
