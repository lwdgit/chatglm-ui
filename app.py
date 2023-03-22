from transformers import AutoModel, AutoTokenizer
import gradio as gr
import json

tokenizer = AutoTokenizer.from_pretrained("./", trust_remote_code=True)
model = AutoModel.from_pretrained("./", trust_remote_code=True).half().cuda()
model = model.eval()

MAX_TURNS = 20
MAX_BOXES = MAX_TURNS * 2


def predict(input, max_length, top_p, temperature, history, state):
    if state is None:
        state = []
    if history is None or history == "":
        history = state
    else:
        history = json.loads(history)
    response, history = model.chat(tokenizer, input, history)
    updates = []
    for query, response in history:
        updates.append(gr.update(visible=True, value=query))
        updates.append(gr.update(visible=True, value=response))
    if len(updates) < MAX_BOXES:
        updates = updates + [gr.Textbox.update(visible=False)] * (MAX_BOXES - len(updates))
    return [history] + updates


with gr.Blocks() as demo:
    state = gr.State([])
    text_boxes = []
    for i in range(MAX_BOXES):
        if i % 2 == 0:
            label = "提问："
        else:
            label = "回复："
        text_boxes.append(gr.Textbox(visible=False, label=label))

    with gr.Row():
        with gr.Column(scale=4):
            txt = gr.Textbox(show_label=False, placeholder="Enter text and press enter").style(container=False)
        with gr.Column(scale=1):
            button = gr.Button("Generate")
            max_length = gr.Slider(0, 4096, value=2048, step=1.0, label="Maximum length", interactive=True)
            top_p = gr.Slider(0, 1, value=0.7, step=0.01, label="Top P", interactive=True)
            temperature = gr.Slider(0, 1, value=0.95, step=0.01, label="Temperature", interactive=True)
        history = gr.TextArea(visible=False)
    button.click(predict, [txt, max_length, top_p, temperature, history, state], [state] + text_boxes)
demo.queue().launch(share=False)
