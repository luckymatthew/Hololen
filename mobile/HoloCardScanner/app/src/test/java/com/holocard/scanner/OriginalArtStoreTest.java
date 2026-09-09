package com.holocard.scanner;

import org.junit.Test;
import static org.junit.Assert.*;

public class OriginalArtStoreTest {
    @Test public void acceptsOnlyOfficialArtwork(){
        assertTrue(OriginalArtStore.allowed("https://hololive-official-cardgame.com/wp-content/images/cardlist/hBP01/hBP01-060_SR.png"));
        assertFalse(OriginalArtStore.allowed("http://hololive-official-cardgame.com/wp-content/images/cardlist/a.png"));
        assertFalse(OriginalArtStore.allowed("https://hololive-official-cardgame.com.evil.example/wp-content/images/cardlist/a.png"));
        assertFalse(OriginalArtStore.allowed("https://hololive-official-cardgame.com/wp-content/images/cardlist/../private.png"));
        assertFalse(OriginalArtStore.allowed("https://user@hololive-official-cardgame.com/wp-content/images/cardlist/a.png"));
        assertFalse(OriginalArtStore.allowed("file:///wp-content/images/cardlist/a.png"));
    }
}
