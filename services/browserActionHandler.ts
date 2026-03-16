/**
 * Browser Action Handler
 * Executes browser automation commands from the backend
 */

import { WebView } from 'react-native-webview';

export class BrowserActionHandler {
  private webViewRef: any = null;

  setWebViewRef(ref: any) {
    this.webViewRef = ref;
  }

  async executeAction(action: string, params: any): Promise<any> {
    console.log(`Executing browser action: ${action}`, params);

    switch (action) {
      case 'load_url':
        return this.loadUrl(params.url);

      case 'search_web':
        return this.searchWeb(params.query);

      case 'click_element':
        return this.clickElement(params.selector, params.description, params?.toolCallId);

      case 'type_text':
        return this.typeText(params.selector, params.text, params.description, params?.toolCallId);

      case 'scroll_page':
        return this.scrollPage(params.direction, params.amount);

      case 'go_back':
        return this.goBack();

      case 'go_forward':
        return this.goForward();

      case 'refresh_page':
        return this.refreshPage();

      case 'get_page_info':
        return this.getPageInfo();

      case 'get_page_text':
        return this.getPageText(params?.toolCallId);

      case 'submit_form':
        return this.submitForm(params.selector, params?.toolCallId);

      case 'wait_for_element':
        return this.waitForElement(params.selector, params.timeout, params?.toolCallId);

      case 'take_screenshot':
        return {
          status: 'success',
          message: 'Capturing screenshot',
          needsScreenshot: true,
        };

      default:
        return {
          status: 'error',
          message: `Unknown action: ${action}`,
        };
    }
  }

  private loadUrl(url: string) {
    if (!this.webViewRef?.current) {
      return { status: 'error', message: 'WebView not available' };
    }

    // WebView will load URL via source prop update
    return {
      status: 'success',
      message: 'Loading URL',
      url: url,
    };
  }

  private searchWeb(query: string) {
    if (!query) return { status: 'error', message: 'No search query provided' };
    
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    return this.loadUrl(searchUrl);
  }

  private clickElement(selector: string, description: string, toolCallId?: string) {
    if (!this.webViewRef?.current) {
      return { status: 'error', message: 'WebView not available' };
    }

    const script = `
      (function() {
        try {
          const element = document.querySelector('${selector}');
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            element.focus();
            element.click();
            element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'action_result',
              tool_call_id: ${toolCallId ? `'${toolCallId}'` : 'null'},
              data: { status: 'success', message: 'Clicked ${description || selector}' }
            }));
            return true;
          }
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'action_result',
            tool_call_id: ${toolCallId ? `'${toolCallId}'` : 'null'},
            data: { status: 'error', message: 'Element not found: ${selector}' }
          }));
          return true;
        } catch (e) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'action_result',
            tool_call_id: ${toolCallId ? `'${toolCallId}'` : 'null'},
            data: { status: 'error', message: e.message }
          }));
          return true;
        }
      })();
    `;

    this.webViewRef.current.injectJavaScript(script);

    return {
      status: 'pending',
      needsResult: true,
      message: `Clicking ${description || selector}`,
    };
  }

  private typeText(selector: string, text: string, description: string, toolCallId?: string) {
    if (!this.webViewRef?.current) {
      return { status: 'error', message: 'WebView not available' };
    }

    const escapedText = text.replace(/'/g, "\\'").replace(/\n/g, '\\n');
    const script = `
      (function() {
        try {
          const element = document.querySelector('${selector}');
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            element.focus();
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
            if (nativeInputValueSetter) {
              nativeInputValueSetter.call(element, '${escapedText}');
            } else {
              element.value = '${escapedText}';
            }
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
            const value = (element.value || '').trim();
            const ok = value === '${escapedText}';
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'action_result',
              tool_call_id: ${toolCallId ? `'${toolCallId}'` : 'null'},
              data: {
                status: ok ? 'success' : 'error',
                message: ok ? 'Text entered in ${description || selector}' : 'Failed to set text for ${description || selector}'
              }
            }));
            return true;
          }
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'action_result',
            tool_call_id: ${toolCallId ? `'${toolCallId}'` : 'null'},
            data: { status: 'error', message: 'Element not found: ${selector}' }
          }));
          return true;
        } catch (e) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'action_result',
            tool_call_id: ${toolCallId ? `'${toolCallId}'` : 'null'},
            data: { status: 'error', message: e.message }
          }));
          return true;
        }
      })();
    `;

    this.webViewRef.current.injectJavaScript(script);

    return {
      status: 'pending',
      needsResult: true,
      message: `Typing into ${description || selector}`,
    };
  }

  private scrollPage(direction: string = 'down', amount: number = 300) {
    if (!this.webViewRef?.current) {
      return { status: 'error', message: 'WebView not available' };
    }

    const scrollAmount = direction === 'down' ? amount : -amount;
    const script = `
      try {
        window.scrollBy({ top: ${scrollAmount}, behavior: 'smooth' });
        if (document.scrollingElement) {
          document.scrollingElement.scrollTop += ${scrollAmount};
        } else {
          document.body.scrollTop += ${scrollAmount};
          document.documentElement.scrollTop += ${scrollAmount};
        }
      } catch (e) {
        window.scrollBy(0, ${scrollAmount});
      }
      true;
    `;

    this.webViewRef.current.injectJavaScript(script);

    return {
      status: 'success',
      message: `Scrolling ${direction}`,
    };
  }

  private goBack() {
    if (!this.webViewRef?.current) {
      return { status: 'error', message: 'WebView not available' };
    }

    this.webViewRef.current.goBack();

    return {
      status: 'success',
      message: 'Going back',
    };
  }

  private goForward() {
    if (!this.webViewRef?.current) {
      return { status: 'error', message: 'WebView not available' };
    }

    this.webViewRef.current.goForward();

    return {
      status: 'success',
      message: 'Going forward',
    };
  }

  private refreshPage() {
    if (!this.webViewRef?.current) {
      return { status: 'error', message: 'WebView not available' };
    }

    this.webViewRef.current.reload();

    return {
      status: 'success',
      message: 'Refreshing page',
    };
  }

  private getPageInfo() {
    if (!this.webViewRef?.current) {
      return { status: 'error', message: 'WebView not available' };
    }

    const script = `
      (function() {
        return JSON.stringify({
          url: window.location.href,
          title: document.title,
          readyState: document.readyState
        });
      })();
    `;

    this.webViewRef.current.injectJavaScript(script);

    return {
      status: 'success',
      message: 'Getting page info',
      needsScreenshot: true,
    };
  }

  private getPageText(toolCallId?: string) {
    if (!this.webViewRef?.current) {
      return { status: 'error', message: 'WebView not available' };
    }

    const script = `
      (function() {
        try {
          // Get visible text, truncated to 4000 chars
          var text = document.body.innerText || '';
          text = text.substring(0, 4000);
          // Get all links
          var links = Array.from(document.querySelectorAll('a')).slice(0, 20).map(function(a) {
            return { text: a.innerText.trim().substring(0, 50), href: a.href };
          }).filter(function(l) { return l.text; });
          // Get all input fields
          var inputs = Array.from(document.querySelectorAll('input, textarea, select')).slice(0, 20).map(function(el) {
            return { 
              type: el.type || el.tagName.toLowerCase(),
              name: el.name || el.id || '',
              placeholder: el.placeholder || '',
              value: el.value || '',
              selector: el.id ? '#' + el.id : (el.name ? '[name="' + el.name + '"]' : '')
            };
          });
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'page_text_result',
            tool_call_id: ${toolCallId ? `'${toolCallId}'` : 'null'},
            data: {
              url: window.location.href,
              title: document.title,
              text: text,
              links: links,
              inputs: inputs
            }
          }));
        } catch(e) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'page_text_result',
            tool_call_id: ${toolCallId ? `'${toolCallId}'` : 'null'},
            data: { error: e.message }
          }));
        }
        return true;
      })();
    `;

    this.webViewRef.current.injectJavaScript(script);

    return {
      status: 'success',
      message: 'Reading page content',
    };
  }

  private submitForm(selector: string, toolCallId?: string) {
    if (!this.webViewRef?.current) {
      return { status: 'error', message: 'WebView not available' };
    }

    const script = `
      (function() {
        try {
          var el = document.querySelector('${selector}');
          if (!el) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'action_result',
              tool_call_id: ${toolCallId ? `'${toolCallId}'` : 'null'},
              data: { status: 'error', message: 'Element not found: ${selector}' }
            }));
            return true;
          }
          if (el.tagName === 'FORM') {
            el.submit();
          } else {
            el.click();
          }
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'action_result',
            tool_call_id: ${toolCallId ? `'${toolCallId}'` : 'null'},
            data: { status: 'success', message: 'Form submitted' }
          }));
          return true;
        } catch(e) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'action_result',
            tool_call_id: ${toolCallId ? `'${toolCallId}'` : 'null'},
            data: { status: 'error', message: e.message }
          }));
          return true;
        }
      })();
    `;

    this.webViewRef.current.injectJavaScript(script);

    return {
      status: 'pending',
      needsResult: true,
      message: 'Submitting form',
    };
  }

  private waitForElement(selector: string, timeout: number = 5000, toolCallId?: string) {
    if (!this.webViewRef?.current) {
      return { status: 'error', message: 'WebView not available' };
    }

    const script = `
      (function() {
        var maxTime = ${timeout};
        var interval = 200;
        var elapsed = 0;
        function check() {
          var el = document.querySelector('${selector}');
          if (el) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'wait_element_result',
              tool_call_id: ${toolCallId ? `'${toolCallId}'` : 'null'},
              data: { status: 'success', message: 'Element found: ${selector}' }
            }));
          } else if (elapsed >= maxTime) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'wait_element_result',
              tool_call_id: ${toolCallId ? `'${toolCallId}'` : 'null'},
              data: { status: 'error', message: 'Timeout waiting for: ${selector}' }
            }));
          } else {
            elapsed += interval;
            setTimeout(check, interval);
          }
        }
        check();
        return true;
      })();
    `;

    this.webViewRef.current.injectJavaScript(script);

    return {
      status: 'success',
      message: `Waiting for element: ${selector}`,
    };
  }
}

export default new BrowserActionHandler();
